# NOTICE

`dsh-chat-thinking-summary` is a fork of
[`@deepseek-ai/dsh-client-ui-chat`](https://github.com/deepseek-ai/deepseek-harness/tree/main/packages/client/ui-chat)
(version 0.2.1-rc.2), Copyright (c) 2026 DeepSeek, licensed under the MIT
License.

The fork changes one component: the collapsed **reasoning row**
(`ReasoningRow`). Upstream shows the first line of the reasoning text and lets
CSS ellipsis cut it; this package cuts at the first complete sentence (capped
at 60 characters), skips leading blank lines and fenced code blocks, and
strips leading Markdown block markers. The implementation lives in
`src/reasoning-summary.js` and is injected into `lib/client.js` by
`scripts/build.mjs`.

Everything else under `lib/` and `locale/` is redistributed unchanged from the
published upstream package; `package.json` is adapted for distribution as a
profile bundle (name, metadata, `dsh.bundle.patch`, compatibility range).

Modifications copyright (c) 2026 sywinksvg, licensed under the MIT License.
