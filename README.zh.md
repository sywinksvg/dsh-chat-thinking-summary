# dsh-chat-thinking-summary

DeepSeek Harness 插件：把折叠状态下的**思考行**从「截断的第一行」改成「**第一句完整的话**」（最多 60 个字符）。

| 上游 | 本插件 |
| --- | --- |
| `思考  D:\DSH is not the source checkout apparently — it's the install dir w…` | `思考  D:\DSH is not the source checkout apparently.` |

## 为什么只能 fork

这一行由核心包 `@deepseek-ai/dsh-client-ui-chat` 里的 `ReasoningRow` 渲染，没有对外插槽。
本包把已发布的核心 bundle（`0.2.1-rc.2`）复制出来，只改这一个组件，再作为一个 profile
bundle 发布。`cordis.patch.yml` 负责禁用核心 `ui-chat` 条目并插入本包，**不需要手改 profile**。

## 安装

要求 DeepSeek Harness **0.2.1-rc.2**（`engines.dsh` 会在其他版本上直接拒绝安装，避免把聊天界面搞坏）。

```bash
# 从 Release 资产安装
dsh plugin --profile web add \
  https://github.com/sywinksvg/dsh-chat-thinking-summary/releases/download/v1.0.0/dsh-chat-thinking-summary-1.0.0.tgz

# 或从本地 tarball
dsh plugin --profile web add /path/to/dsh-chat-thinking-summary-1.0.0.tgz
```

`dsh plugin add` 会安装依赖并**自动把它追加进** `dsh.profile.bundles`。装完重启 Harness 服务，再刷新页面。

**回滚：** `dsh plugin --profile web remove dsh-chat-thinking-summary`。补丁层消失后核心 `ui-chat` 会自动恢复。

## 改了什么

只改 `ReasoningRow` 背后的摘要函数：

- 在第一个句末标点处截断 —— `.`、`!`、`?`、`。`、`！`、`？`、`…`；英文句点只在词尾生效，所以 `1.5`、`e.g.` 不会被切断；
- 上限 60 个字符，超出补 `…`；按码点截断，绝不切开代理对（emoji 保持完整），英文优先在词边界断开；
- 跳过开头空行和围栏代码块，并去掉行首 Markdown 块标记（`#`、`>`、`-`、`1.`），避免标题本身变成整条摘要。

实现唯一事实源是 [`src/reasoning-summary.js`](src/reasoning-summary.js)，单测在 [`test/`](test/)。
bundle 其余部分与上游逐字节一致 —— 见 [NOTICE.md](NOTICE.md)。

## 构建与校验

```bash
npm run build:from-npm   # 下载并打补丁：@deepseek-ai/dsh-client-ui-chat@0.2.1-rc.2
npm test                 # 摘要函数单测
npm run verify           # 补丁是否落位 / bundle 能否解析 / 补丁文件与包名是否匹配
```

从本机已安装副本构建：

```bash
node scripts/build.mjs --from "/path/to/node_modules/@deepseek-ai/dsh-client-ui-chat"
```

`npm pack` 会自动跑测试和 `verify`。DSH 升级核心聊天包时：改 `scripts/build.mjs` 里的
`CORE_VERSION` → 重新构建 → 重新测试 → 打个新 tag（GitHub Actions 会自动重建并附上 tarball）。

## 卸载

```bash
dsh plugin --profile web remove dsh-chat-thinking-summary
```

## 许可

MIT —— 见 [LICENSE](LICENSE) 与 [NOTICE.md](NOTICE.md)。

English: [README.md](README.md)
