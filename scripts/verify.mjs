#!/usr/bin/env node
/**
 * Verify the shipped tree: the fork landed, the bundle parses, and the
 * profile patch matches the package identity. Runs in CI and on `npm pack`.
 */
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const failures = [];

const check = (label, condition, detail = '') => {
  if (condition) {
    process.stdout.write(`✅ ${label}\n`);
  } else {
    failures.push(detail === '' ? label : `${label}: ${detail}`);
    process.stdout.write(`❌ ${label}${detail === '' ? '' : `: ${detail}`}\n`);
  }
};

const packageJson = JSON.parse(await readFile(join(ROOT, 'package.json'), 'utf8'));
const client = await readFile(join(ROOT, 'lib/client.js'), 'utf8');
const patch = await readFile(join(ROOT, 'cordis.patch.yml'), 'utf8');

check('package identity', packageJson.name === 'dsh-chat-thinking-summary', packageJson.name);
check('package version', /^\d+\.\d+\.\d+$/.test(packageJson.version), packageJson.version);
check(
  'repository points at the fork',
  String(packageJson.repository?.url ?? '').includes('sywinksvg/dsh-chat-thinking-summary'),
  packageJson.repository?.url,
);

const required = [
  'LICENSE',
  'NOTICE.md',
  'README.md',
  'README.zh.md',
  'CHANGELOG.md',
  'cordis.patch.yml',
  'lib/client.js',
  'lib/index.js',
  'lib/types/index.d.ts',
  'locale/en.json',
  'locale/zh.json',
];
for (const file of required) {
  check(`file ${file}`, existsSync(join(ROOT, file)));
}

check('injected region present once', client.split('#region dsh-chat-thinking-summary').length === 2);
check(
  'upstream firstLine replaced',
  !client.includes('return newline === -1 ? text : text.slice(0, newline);'),
);
check(
  'paragraph candidate routed through firstLine()',
  client.includes('const candidate = firstLine(text.slice(paragraphStart, newline));'),
);
check(
  'sentence cap installed',
  client.includes('MAX_SUMMARY_LENGTH = 60'),
);

check('patch disables core ui-chat', /-\s+id:\s*ui-chat\s*\n\s+disabled:\s*true/.test(patch));
check(
  'patch inserts this package',
  new RegExp(`name:\\s*${packageJson.name}`).test(patch),
);
check(
  'dsh.bundle.patch resolves',
  packageJson.dsh?.bundle?.patch !== undefined &&
    existsSync(join(ROOT, packageJson.dsh.bundle.patch)),
  packageJson.dsh?.bundle?.patch,
);
check(
  'dsh.client.inject declared',
  Array.isArray(packageJson.dsh?.client?.inject) && packageJson.dsh.client.inject.length > 0,
);
check('platform is web', packageJson.dsh?.client?.platform === 'web');
check(
  'engines.dsh gates the install',
  typeof packageJson.engines?.dsh === 'string' && packageJson.engines.dsh !== '',
);
check(
  'files keeps lib/types',
  (packageJson.files ?? []).includes('lib/types/**/*.d.ts'),
);

for (const file of ['lib/index.js', 'lib/client.js', 'src/reasoning-summary.js']) {
  try {
    execFileSync(process.execPath, ['--check', join(ROOT, file)], { stdio: 'pipe' });
    check(`node --check ${file}`, true);
  } catch (error) {
    check(`node --check ${file}`, false, String(error.stderr ?? error).trim().split('\n')[0]);
  }
}

if (failures.length > 0) {
  process.stderr.write(`\nverify: ${failures.length} check(s) failed\n`);
  process.exit(1);
}
process.stdout.write(`\nverify: ok (${packageJson.name}@${packageJson.version})\n`);
