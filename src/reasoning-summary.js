/**
 * dsh-chat-thinking-summary — collapsed reasoning-row summary.
 *
 * Upstream (`@deepseek-ai/dsh-client-ui-chat`) shows the first *line* of the
 * assistant reasoning and lets CSS ellipsis cut it, which usually reads like a
 * broken sentence. This fork keeps the first *complete sentence* instead.
 *
 * This file is the single source of truth: `scripts/build.mjs` injects it into
 * `lib/client.js` verbatim (indented, `export` keywords stripped), so the
 * bundle and the unit tests share one implementation.
 */

/** Maximum number of code points shown before the trailing ellipsis. */
export const MAX_SUMMARY_LENGTH = 60;

/** Sentence terminators; a Latin period only counts at a word end. */
const SENTENCE_END = /[。！？!?…]|\.(?=\s|$)/g;

/** Latin abbreviations whose trailing period does not end the sentence. */
const ABBREVIATIONS = new Set([
  'e.g',
  'i.e',
  'etc',
  'vs',
  'cf',
  'al',
  'approx',
  'mr',
  'mrs',
  'ms',
  'dr',
  'prof',
  'a.m',
  'p.m',
  'u.s',
  'u.k',
]);

/** Closing quotes and brackets that belong to the sentence before them. */
const CLOSERS = new Set(['”', '’', '"', "'", '」', '』', '）', ')', ']', '】', '》']);

/** A whole line that is only a Markdown code fence ("```" / "```js"). */
const FENCE_LINE = /^`{3,}[\w+-]*$/;

/** Leading Markdown block markers that add nothing to a one-line summary. */
const BLOCK_MARKER = /^(?:#{1,6}\s+|>\s?|[-+*]\s+|\d+[.)]\s+)/;

/**
 * First line that carries prose: skips blank lines, fenced code blocks and
 * Markdown block markers (`#`, `>`, `-`, `1.`) so a heading does not become
 * the whole summary.
 *
 * @param {string} text Raw reasoning text.
 * @returns {string} A non-empty line with block markers removed, or "".
 */
export function firstMeaningfulLine(text) {
  let inFence = false;
  for (const raw of String(text).split(/\r?\n/)) {
    const trimmed = raw.trim();
    if (FENCE_LINE.test(trimmed)) {
      inFence = !inFence;
      continue;
    }
    if (inFence || trimmed === '') continue;
    let line = trimmed;
    let previous;
    do {
      previous = line;
      line = line.replace(BLOCK_MARKER, '').trimStart();
    } while (line !== previous);
    if (line !== '') return line;
  }
  return '';
}

/**
 * Cap `text` at `max` code points. Never splits a surrogate pair (emoji stay
 * whole) and prefers the last word boundary when the text is space-delimited.
 *
 * @param {string} text Text to cap.
 * @param {number} [max] Code-point budget.
 * @returns {string} The text, or a capped copy ending in "…".
 */
export function truncateSummary(text, max = MAX_SUMMARY_LENGTH) {
  const chars = Array.from(text);
  if (chars.length <= max) return text;
  let cut = chars.slice(0, max);
  const lastSpace = cut.lastIndexOf(' ');
  if (lastSpace >= Math.floor(max * 0.6)) cut = cut.slice(0, lastSpace);
  return `${cut.join('').trimEnd()}…`;
}

/** Whether the period at `dot` closes a known abbreviation or an initial. */
function isAbbreviation(line, dot) {
  const word = /([A-Za-z][A-Za-z.]*)$/.exec(line.slice(0, dot))?.[1] ?? '';
  if (word === '') return false;
  if (/^[A-Z]$/.test(word)) return true;
  return ABBREVIATIONS.has(word.toLowerCase());
}

/** End offset (exclusive) of the terminator at `index`, including its run and closers. */
function endOfTerminator(line, index) {
  let end = index + 1;
  while (line[end] === line[index]) end += 1;
  while (end < line.length && CLOSERS.has(line[end])) end += 1;
  return end;
}

/** Index of the first real sentence terminator, or -1. */
function sentenceEnd(line) {
  const pattern = new RegExp(SENTENCE_END.source, 'g');
  let match;
  while ((match = pattern.exec(line)) !== null) {
    if (match[0] === '.' && isAbbreviation(line, match.index)) continue;
    return match.index;
  }
  return -1;
}

/**
 * The one-line summary shown in the collapsed thinking row.
 *
 * @param {string} text Raw reasoning text.
 * @returns {string} First complete sentence, capped and trimmed.
 */
export function summarize(text) {
  const line = firstMeaningfulLine(text);
  if (line === '') return '';
  const index = sentenceEnd(line);
  const sentence = (index === -1 ? line : line.slice(0, endOfTerminator(line, index))).trim();
  return truncateSummary(sentence);
}

/**
 * Name used by the upstream `ReasoningRow`; kept so the generated block drops
 * into `lib/client.js` without further renaming.
 *
 * @param {string} text Raw reasoning text.
 * @returns {string} See {@link summarize}.
 */
export function firstLine(text) {
  return summarize(text);
}
