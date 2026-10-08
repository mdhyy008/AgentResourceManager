# AgentResourceManager

扫描并统一管理本机上各个 AI coding agent 的资源 —— **Skills / MCP / 记忆 / Plugins** 四类，看得见、改得了、改坏了能撤。

一台机器上通常同时装着 Claude Code、Cursor、通义灵码等好几个 agent，各家的技能、MCP 配置、记忆文件散落在互不相通的目录里：谁在用什么、哪些其实是同一份、哪几条只在某个项目里生效，全靠脑子记。这个工具把它们扫到一处摊开，并且允许你在看得见 diff 的前提下安全地修改。

## 功能

### 扫描与展示

- 自动探测本机装了哪些 agent，按资源类型分类展示：`Skills` / `MCP` / `记忆` / `Plugins` / `异常`。
- 跨 agent 的重复资源按真实落盘路径（已 resolve 符号链接）**合并成一条**，并标出「被哪些 agent 引用」。
- 顶栏可按 agent 过滤，侧栏按类型计数；列表支持关键词搜索、用户级/项目级筛选。
- 项目级资源会在标题旁注明所属项目名，便于区分同名技能。
- 扫描结果落磁盘缓存，冷启动秒显，随后异步跑一次全量扫描覆盖。

### 写入（四项，全部先看 diff 再落盘）

- **编辑 skill frontmatter**：表单化编辑键值对，数组/对象用 JSON 表示。
- **启用 / 禁用 skill**：切换 Claude Code 的 `disable-model-invocation` 开关。
- **新增 / 删除 MCP server**：写入 `~/.claude.json` 的 `mcpServers` 子树（只比较该子树的哈希，不动文件其余部分）。
- **编辑记忆正文**：直接改 `MEMORY.md` / `CLAUDE.md` / `AGENTS.md` 等文件的正文。
- 额外：**把 skill 共享给另一个 agent**，可选「目录联接」（junction，不占空间、改一处两边同步）或「复制一份」（各自独立）。

### 批量操作

列表可进入多选模式，对选中的项批量**启用 / 禁用 / 共享给其它 agent**。执行前先摊开「将处理哪些、跳过哪些（及原因）」，执行后逐条汇报成功与失败。

### 安全机制

- **写入前快照备份**，每次操作在「操作记录」里可逐条撤销。
- **冲突检测**：写入前校验目标文件的 mtime 与内容哈希，扫描之后被外部改过就拒绝写入，避免覆盖别人的改动。
- **只读保护**：随插件安装的 skill 标记为只读（插件升级会覆盖），不提供编辑入口。
- **导出**：把选中的资源打包成 zip，导出前弹确认；MCP 只导出 `mcpServers` 子树，不导出整个配置文件。

## 支持的 agent

内置：**Claude Code**、**Cursor**、**通义灵码**、**`.agents`**（跨 agent 共享的 skill 仓库）；预置探测：**Codex CLI**、**Gemini CLI**、**Windsurf**、**Trae**、**Continue**。

未覆盖的 agent 可以**登记自定义路径**（目前只登记 skills 与 MCP —— 这是刻意的范围，不是缺口）。

## 资源从哪来

| 资源 | 用户级 | 项目级 |
| --- | --- | --- |
| **Skills** | `~/.<agent>/skills/*/SKILL.md`（含插件自带的只读 skill） | `<项目>/.claude/skills/*/SKILL.md` |
| **MCP** | `~/.claude.json` 的 `mcpServers`，以及 `~/.cursor/mcp.json`、`~/.<agent>/…` 等各家配置文件 | `<项目>/.mcp.json` |
| **记忆** | `~/.claude/CLAUDE.md`、`~/.gemini/GEMINI.md`、`~/.codex/AGENTS.md`、`~/.agents/AGENTS.md` | `<项目>/{CLAUDE,AGENTS,GEMINI}.md`、`.cursorrules`、`~/.claude/projects/<slug>/memory/*.md` |
| **Plugins** | `~/.claude/plugins/` 的清单与缓存目录 | — |

项目级扫描由 `~/.claude.json` 里登记过的项目清单驱动，不做全盘递归 —— 比满盘搜索可靠，也不会把无关目录里的文件翻出来。

## 界面

三栏布局：左侧是资源分类导航（带计数），中间是资源列表与筛选，右侧是选中项的详情（落盘路径、被哪些 agent 引用、正文，以及可用的操作）。写入前会弹出 diff 预览，确认后才落盘。

## 技术栈

Electron 44 + electron-vite 5 + Vite 7 + React 19 + TypeScript + MUI v9。单元测试用 Vitest，zip 打包为自研实现（无外部依赖）。

渲染进程开启 `contextIsolation` + `sandbox`，关闭 `nodeIntegration`；通过 CSP 与自定义协议加载页面，不使用 `webSecurity: false`。

## 快速开始

```bash
npm install
npm run dev        # 开发模式启动桌面应用
npm run scan       # 命令行跑一次扫描并打印 JSON
npm test           # 单元测试
npm run typecheck  # 三个 tsconfig 全量类型检查
```

> 如果 `npm install` 卡在 electron 二进制下载，给 npm 配一下国内镜像（例如 `ELECTRON_MIRROR`）再装。

## 项目结构

```
src/
  core/       纯 Node 逻辑：资源扫描器、adapter 探测、去重、frontmatter 解析、磁盘缓存
  main/       Electron 主进程：IPC、各写入器、备份与撤销、导出
  preload/    上下文隔离桥（CJS）
  renderer/   React + MUI 界面（组件 / lib / theme）
  shared/     主进程与渲染进程共享的 IPC 类型
tests/        Vitest 单元测试，含一个「五脏俱全」的假 home fixture
```

`core/` 不依赖 Electron，可以单独用命令行跑（`npm run scan`），也方便直接单测。

## 设计取舍

- **项目级扫描只认登记过的项目**：以 `~/.claude.json` 的项目清单为准，不递归全盘。
- **自定义 agent 只登记 skills / MCP**：刻意收敛范围。
- **per-project 记忆靠 slug 正向换算**：把项目绝对路径换算成 `~/.claude/projects/<slug>` 去比对，不做逆向反推（路径里的分隔符和 `-` 无法区分）。
- **MCP 密钥不做遮罩**：作为本地工具，`env` / `headers` 里的值按原样展示与保留，导出为 zip 前会先弹确认。
- **仅开发模式运行**：目前没有打包分发。

## 许可证

暂未指定。
