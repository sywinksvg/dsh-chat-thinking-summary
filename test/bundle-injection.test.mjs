import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { test } from 'node:test';
import { summarize } from '../src/reasoning-summary.js';

const clientPath = new URL('../lib/client.js', import.meta.url);
const built = existsSync(clientPath);

/**
 * Pull the generated region out of the shipped bundle and instantiate its
 * `firstLine`. This is the artifact users actually run — comparing it with the
 * source catches drift between `src/` and `lib/`.
 */
const loadBundleFirstLine = () => {
  const client = readFileSync(clientPath, 'utf8');
  const start = client.indexOf('// #region dsh-chat-thinking-summary');
  const end = client.indexOf('// #endregion dsh-chat-thinking-summary');
  assert.ok(start !== -1 && end > start, 'generated region missing from lib/client.js');
  const body = client.slice(start, end).replace(/^\s*\/\/ #region[^\n]*\n/, '');
  return new Function(`${body}\nreturn firstLine;`)();
};

const samples = [
  '',
  'D:\\DSH is not the source checkout apparently. It is the install dir.',
  '先看配置。然后再改代码。',
  '## 分析\n下一行',
  '```js\nconst x = 1;\n```\nProse after the fence. More.',
  'Use e.g. the fast path here.',
  'a'.repeat(200),
];

test('built bundle exports the same summary as src/', { skip: !built && 'run npm run build first' }, () => {
  const firstLine = loadBundleFirstLine();
  for (const sample of samples) {
    assert.equal(firstLine(sample), summarize(sample), JSON.stringify(sample.slice(0, 40)));
  }
});

test('built bundle keeps the shorthand row readable', { skip: !built && 'run npm run build first' }, () => {
  const firstLine = loadBundleFirstLine();
  assert.equal(
    firstLine('D:\\DSH is not the source checkout apparently. It is the install dir.'),
    'D:\\DSH is not the source checkout apparently.',
  );
});
