# Changelog

## 1.0.0 — 2026-11-02

First public release.

- Collapsed thinking row shows the first **complete sentence** (≤60 characters)
  instead of the truncated first line.
- Skips leading blank lines and fenced code blocks; strips leading Markdown
  block markers (`#`, `>`, `-`, `1.`).
- Truncation is code-point aware (never splits a surrogate pair) and prefers a
  word boundary for space-delimited text.
- Reproducible build from `@deepseek-ai/dsh-client-ui-chat@0.2.1-rc.2`
  (`scripts/build.mjs`) with unit tests and a shipped-tree verifier.
- `engines.dsh` gates installation to the compatible DSH line.
