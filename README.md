# dsh-chat-thinking-summary

A drop-in replacement for `@deepseek-ai/dsh-client-ui-chat` in **DeepSeek
Harness** that changes one thing: the collapsed **thinking** row shows the
**first complete sentence** (capped at 60 characters) instead of a hard-cut
first line.

| upstream | this fork |
| --- | --- |
| `思考  D:\DSH is not the source checkout apparently — it's the install dir w…` | `思考  D:\DSH is not the source checkout apparently.` |

## Why a fork instead of a plugin

The row is rendered by `ReasoningRow` inside the core chat package, which
exposes no slot for it. This package copies the published core bundle
(`0.2.1-rc.2`), patches that single component, and ships it as a profile
bundle. `cordis.patch.yml` disables the core `ui-chat` entry and inserts this
one, so no manual profile editing is needed.

## Install

Requires DeepSeek Harness **0.2.1-rc.2** — `engines.dsh` rejects other
runtimes instead of risking a broken chat view.

```bash
# from the release asset
dsh plugin --profile web add \
  https://github.com/sywinksvg/dsh-chat-thinking-summary/releases/download/v1.0.0/dsh-chat-thinking-summary-1.0.0.tgz

# or from a local tarball
dsh plugin --profile web add /path/to/dsh-chat-thinking-summary-1.0.0.tgz
```

`dsh plugin add` installs the package **and** appends it to
`dsh.profile.bundles`. Restart the Harness service, then refresh the page.

**Rollback:** `dsh plugin --profile web remove dsh-chat-thinking-summary`.
The core `ui-chat` entry re-enables itself as soon as the patch layer is gone.

## What changed

Only the summary function behind `ReasoningRow`:

- cut at the first sentence terminator — `.`, `!`, `?`, `。`, `！`, `？`, `…`;
  a Latin period only counts at a word end, so `1.5` and `e.g.` survive;
- cap at 60 characters and append `…`; truncation never splits a surrogate
  pair (emoji stay whole) and prefers a word boundary for space-delimited text;
- skip leading blank lines and fenced code blocks, and strip leading Markdown
  block markers (`#`, `>`, `-`, `1.`) so a heading does not become the whole
  summary.

The canonical implementation is [`src/reasoning-summary.js`](src/reasoning-summary.js);
its unit tests are in [`test/`](test/). Everything else in the bundle is
upstream byte for byte — see [NOTICE.md](NOTICE.md).

## Build and verify

```bash
npm run build:from-npm   # download and patch @deepseek-ai/dsh-client-ui-chat@0.2.1-rc.2
npm test                 # unit tests for the summary function
npm run verify           # patch landed? bundle parses? patch file matches?
```

Or build from an installed copy:

```bash
node scripts/build.mjs --from "/path/to/node_modules/@deepseek-ai/dsh-client-ui-chat"
```

`npm pack` runs the tests and `verify` automatically. When DSH upgrades its
core chat package, bump `CORE_VERSION` in `scripts/build.mjs`, rebuild, retest,
and publish a new tag (GitHub Actions rebuilds and attaches the tarball).

## Uninstall

```bash
dsh plugin --profile web remove dsh-chat-thinking-summary
```

## License

MIT — see [LICENSE](LICENSE) and [NOTICE.md](NOTICE.md).

中文说明：[README.zh.md](README.zh.md)
