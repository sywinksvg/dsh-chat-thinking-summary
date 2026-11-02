import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  MAX_SUMMARY_LENGTH,
  firstMeaningfulLine,
  summarize,
  truncateSummary,
} from '../src/reasoning-summary.js';

test('cuts at the first English sentence', () => {
  assert.equal(
    summarize('D:\\DSH is not the source checkout apparently. It is the install dir.'),
    'D:\\DSH is not the source checkout apparently.',
  );
});

test('cuts at the first CJK sentence', () => {
  assert.equal(summarize('先看配置。然后再改代码。'), '先看配置。');
});

test('keeps decimal points inside a sentence', () => {
  assert.equal(summarize('吞吐量提升 1.5 倍。后面还有一句。'), '吞吐量提升 1.5 倍。');
});

test('does not cut inside an abbreviation', () => {
  assert.equal(summarize('Use e.g. the fast path here.'), 'Use e.g. the fast path here.');
  assert.equal(summarize('The U.S. team won. Next sentence.'), 'The U.S. team won.');
});

test('keeps a closing quote inside the sentence', () => {
  assert.equal(summarize('他说：“完成。”后面继续。'), '他说：“完成。”');
});

test('returns the whole line when there is no terminator', () => {
  assert.equal(summarize('no punctuation here at all'), 'no punctuation here at all');
});

test('strips Markdown headings', () => {
  assert.equal(summarize('## 分析\n下一行'), '分析');
});

test('strips block quotes, bullets and ordered-list markers', () => {
  assert.equal(summarize('> - 检查配置\n下一行'), '检查配置');
  assert.equal(summarize('1. 先确认版本'), '先确认版本');
});

test('skips leading blank lines', () => {
  assert.equal(summarize('\n\n  First real line. Second sentence.'), 'First real line.');
});

test('skips fenced code blocks', () => {
  assert.equal(summarize('```js\nconst x = 1;\n```\nProse after the fence. More.'), 'Prose after the fence.');
});

test('an unterminated fence yields an empty summary', () => {
  assert.equal(summarize('```js\nconst x = 1;'), '');
});

test('treats an ellipsis as a sentence end', () => {
  assert.equal(summarize('等等……后面继续'), '等等……');
  assert.equal(summarize('etc... more text'), 'etc...');
});

test('caps long text at the code-point budget', () => {
  const long = 'a'.repeat(200);
  const summary = summarize(long);
  assert.equal(summary.length, MAX_SUMMARY_LENGTH + 1);
  assert.ok(summary.endsWith('…'));
});

test('prefers a word boundary when truncating', () => {
  const text = `${'word '.repeat(20)}end.`;
  const summary = summarize(text);
  assert.ok(!summary.endsWith('wor…'), summary);
  assert.ok(summary.endsWith('…'));
  assert.ok(!/\s…$/.test(summary), 'trailing space before the ellipsis');
});

test('never splits a surrogate pair', () => {
  const text = `${'字'.repeat(MAX_SUMMARY_LENGTH - 1)}😀尾`;
  const summary = truncateSummary(text, MAX_SUMMARY_LENGTH);
  assert.equal(Array.from(summary).length, MAX_SUMMARY_LENGTH + 1);
  assert.ok(!/[\uD800-\uDBFF](?![\uDC00-\uDFFF])/.test(summary), 'lone high surrogate');
  assert.ok(!/(^|[^\uD800-\uDBFF])[\uDC00-\uDFFF]/.test(summary), 'lone low surrogate');
});

test('empty text yields an empty summary', () => {
  assert.equal(summarize(''), '');
  assert.equal(summarize('\n\n'), '');
});

test('firstMeaningfulLine keeps Markdown inline emphasis for the caller', () => {
  assert.equal(firstMeaningfulLine('**重点**：先备份。'), '**重点**：先备份。');
});
