#!/usr/bin/env node
/**
 * Rebuild the fork from the published core package.
 *
 * Copies `lib/` and `locale/` from `@deepseek-ai/dsh-client-ui-chat` and injects
 * the reasoning-summary implementation from `src/reasoning-summary.js` into
 * `lib/client.js`. The generated tree is what `npm pack` ships.
 *
 * Usage:
 *   node scripts/build.mjs --from <path-to-installed-core-package>
 *   node scripts/build.mjs --from-npm        # npm pack the pinned version
 *   node scripts/build.mjs --from-npm --force  # allow a version mismatch
 */
import { execSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { cp, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gunzipSync } from 'node:zlib';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CORE_NAME = '@deepseek-ai/dsh-client-ui-chat';

/** Core version this fork is built from. Bump together with a rebuild. */
const CORE_VERSION = '0.2.1-rc.2';

/** Identifiers the injected block introduces; must not exist in the bundle. */
const INJECTED_IDENTIFIERS = [
  'MAX_SUMMARY_LENGTH',
  'SENTENCE_END',
  'ABBREVIATIONS',
  'CLOSERS',
  'FENCE_LINE',
  'BLOCK_MARKER',
  'firstMeaningfulLine',
  'truncateSummary',
  'isAbbreviation',
  'endOfTerminator',
  'sentenceEnd',
  'summarize',
];

/** Upstream `firstLine`, replaced by the generated block. */
const UPSTREAM_FIRST_LINE =
  '\t\tfunction firstLine(text) {\n' +
  '\t\t\tconst newline = text.indexOf("\\n");\n' +
  '\t\t\treturn newline === -1 ? text : text.slice(0, newline);\n' +
  '\t\t}';

/** Upstream call site inside `latestCompletedParagraphFirstLine`, routed through the fork. */
const UPSTREAM_CANDIDATE =
  'const candidate = text.slice(paragraphStart, newline).trim();';

const argv = process.argv.slice(2);
const takeValue = (name) => {
  const index = argv.indexOf(name);
  return index === -1 ? undefined : argv[index + 1];
};
const fromPath = takeValue('--from');
const fromNpm = argv.includes('--from-npm');
const force = argv.includes('--force');

const fail = (message) => {
  process.stderr.write(`build: ${message}\n`);
  process.exit(1);
};

/** Resolve an already-installed core package through Node resolution. */
const fromInstalled = () => {
  const require = createRequire(join(ROOT, 'package.json'));
  try {
    return dirname(require.resolve(`${CORE_NAME}/package.json`));
  } catch {
    return undefined;
  }
};

/** Read a NUL-terminated field from a tar header. */
const field = (header, start, end) =>
  header.subarray(start, end).toString('utf8').replace(/\0[\s\S]*$/, '');

/** Read an octal number from a tar header. */
const octal = (header, start, end) => {
  const raw = field(header, start, end).trim();
  return raw === '' ? 0 : Number.parseInt(raw, 8);
};

/**
 * Extract a .tgz without shelling out: the Git Bash `tar` on Windows treats
 * `C:\...` as a remote host, and CI images vary. Only regular files and
 * directories are needed for an npm tarball.
 */
const extractTarGz = (tarball, destination) => {
  const buffer = gunzipSync(readFileSync(tarball));
  const root = resolve(destination);
  let offset = 0;
  let paxPath;

  while (offset + 512 <= buffer.length) {
    const header = buffer.subarray(offset, offset + 512);
    if (header.every((byte) => byte === 0)) break;

    const size = octal(header, 124, 136);
    const type = String.fromCharCode(header[156] || 0x30);
    const prefix = field(header, 345, 500);
    let name = field(header, 0, 100);
    if (prefix !== '') name = `${prefix}/${name}`;

    offset += 512;
    const data = buffer.subarray(offset, offset + size);
    offset += Math.ceil(size / 512) * 512;

    if (type === 'x' || type === 'g') {
      paxPath = /^(?:\d+ )?path=(.*)$/m.exec(data.toString('utf8'))?.[1].trim();
      continue;
    }
    if (paxPath !== undefined) {
      name = paxPath;
      paxPath = undefined;
    }

    const target = resolve(root, name);
    if (target !== root && !target.startsWith(`${root}${sep}`)) continue;

    if (type === '5') {
      mkdirSync(target, { recursive: true });
    } else if (type === '0' || type === '\0') {
      mkdirSync(dirname(target), { recursive: true });
      writeFileSync(target, data);
    }
  }

  return root;
};

/** Download and extract the pinned core package from the configured registry. */
const fromRegistry = async () => {
  const scratch = await mkdtemp(join(tmpdir(), 'dsh-core-'));
  const tarball = execSync(`npm pack ${CORE_NAME}@${CORE_VERSION} --silent`, {
    cwd: scratch,
    stdio: ['ignore', 'pipe', 'inherit'],
  })
    .toString()
    .trim()
    .split(/\r?\n/)
    .at(-1);
  extractTarGz(join(scratch, tarball), scratch);
  return { dir: join(scratch, 'package'), scratch };
};

const locateCore = async () => {
  if (fromPath !== undefined) {
    return { dir: resolve(fromPath), scratch: undefined };
  }
  if (fromNpm) return fromRegistry();
  const installed = fromInstalled();
  if (installed !== undefined) return { dir: installed, scratch: undefined };
  fail(
    `cannot find ${CORE_NAME}.\n` +
      '  pass --from <path> or run with --from-npm (downloads the pinned version).',
  );
};

/** Indent every non-empty line by two tabs, matching the bundle region style. */
const indent = (text) =>
  text
    .split('\n')
    .map((line) => (line === '' ? line : `\t\t${line}`))
    .join('\n');

/** Turn the source's two-space indentation into the bundle's tab indentation. */
const reindent = (text) =>
  text
    .split('\n')
    .map((line) => {
      const spaces = /^ +/.exec(line)?.[0].length ?? 0;
      if (spaces === 0) return line;
      return `${'\t'.repeat(Math.floor(spaces / 2))}${' '.repeat(spaces % 2)}${line.slice(spaces)}`;
    })
    .join('\n');

const main = async () => {
  const core = await locateCore();
  try {
    const manifestPath = join(core.dir, 'package.json');
    const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
    if (manifest.name !== CORE_NAME) {
      fail(`${manifestPath} is ${manifest.name}, expected ${CORE_NAME}`);
    }
    if (manifest.version !== CORE_VERSION && !force) {
      fail(
        `core version ${manifest.version} does not match ${CORE_VERSION}.\n` +
          '  bump CORE_VERSION (and rebuild/retest) or pass --force.',
      );
    }

    for (const entry of ['lib', 'locale']) {
      await rm(join(ROOT, entry), { recursive: true, force: true });
      await cp(join(core.dir, entry), join(ROOT, entry), { recursive: true });
    }

    const clientPath = join(ROOT, 'lib', 'client.js');
    let source = await readFile(clientPath, 'utf8');

    const occurrences = (haystack, needle) => haystack.split(needle).length - 1;
    if (occurrences(source, UPSTREAM_FIRST_LINE) !== 1) {
      fail('upstream firstLine() not found exactly once; the core bundle changed.');
    }
    if (occurrences(source, UPSTREAM_CANDIDATE) !== 1) {
      fail('upstream candidate line not found exactly once; the core bundle changed.');
    }

    for (const identifier of INJECTED_IDENTIFIERS) {
      if (new RegExp(`\\b${identifier}\\b`).test(source)) {
        fail(`identifier "${identifier}" already exists in the bundle; rename it.`);
      }
    }

    let summarySource = await readFile(join(ROOT, 'src', 'reasoning-summary.js'), 'utf8');
    summarySource = reindent(
      summarySource.replace(/^export\s+(const|function)\s/gm, '$1 ').trimEnd(),
    );

    const injected =
      '\t\t// #region dsh-chat-thinking-summary (generated from src/reasoning-summary.js)\n' +
      `${indent(summarySource)}\n` +
      '\t\t// #endregion dsh-chat-thinking-summary';

    source = source.replace(UPSTREAM_FIRST_LINE, () => injected);
    source = source.replace(
      UPSTREAM_CANDIDATE,
      'const candidate = firstLine(text.slice(paragraphStart, newline));',
    );

    await writeFile(clientPath, source);

    const digest = createHash('sha256').update(source).digest('hex');
    process.stdout.write(
      `build: ${manifest.name}@${manifest.version}\n` +
        `build: lib/client.js ${Buffer.byteLength(source)} bytes sha256=${digest}\n` +
        'build: ok\n',
    );
  } finally {
    if (core.scratch !== undefined) await rm(core.scratch, { recursive: true, force: true });
  }
};

await main();
