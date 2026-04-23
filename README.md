# Esay Cloud Skills

[English](#english) | [中文](#chinese)

---

<a name="english"></a>
## English

`esay-cloud-skills` is a macOS-first CLI and Desktop app that helps you manage AI tool skills in one iCloud-backed location and wires local tool folders to that shared source via symlinks.

It currently supports (each has its own iCloud subfolder; see table below):
- A shared **global** category, plus **Codex**, **Claude Code**, **Cursor**, **Antigravity**
- **OpenCode**, **OpenClaw**, and **Hermes** (Nous Research Hermes Agent)
- A Tauri desktop shell for macOS

### Skill categories (CLI `target` keys)

Each **category** maps a CLI target name, one iCloud subfolder under your `AI-Skills` root, and the default local path(s) the app looks for first. Use the **Key** in commands such as `link <key>` and `list-skills <key>`. (Paths follow each product’s public docs as of 2025–2026.)

| Key | Product | Role | Default local path(s) | iCloud folder |
| --- | --- | --- | --- | --- |
| `global` | (shared) | Cross-tool or generic agent skills | `~/.agent/skills` | `…/AI-Skills/global` |
| `codex` | OpenAI Codex | Codex-only skills | `~/.codex/skills` | `…/AI-Skills/codex` |
| `claude` | Claude Code | Claude Code–only skills | `~/.claude/skills` (tries `~/.claude-code/…` and `~/.config/claude-code/…` as alternates) | `…/AI-Skills/claude-code` |
| `antigravity` | Antigravity | Antigravity-only skills | `~/.antigravity/skills` (or `~/.config/antigravity/…`) | `…/AI-Skills/antigravity` |
| `cursor` | Cursor | Cursor user-level skills | `~/.cursor/skills`, or `~/.agents/skills` if present | `…/AI-Skills/cursor` |
| `opencode` | [OpenCode](https://opencode.ai/docs/skills) | OpenCode user-level skills | `~/.config/opencode/skills` | `…/AI-Skills/opencode` |
| `openclaw` | [OpenClaw](https://docs.openclaw.ai/tools/skills) | Managed / local override skills | `~/.openclaw/skills` (OpenClaw also reads `~/.agents/skills` with different precedence) | `…/AI-Skills/openclaw` |
| `hermes` | [Hermes Agent](https://hermes-agent.nousresearch.com/docs/user-guide/features/skills/) | Main Hermes skills tree | `~/.hermes/skills` | `…/AI-Skills/hermes` |

`all` is accepted where the CLI allows it (e.g. `list-skills all`, `link all`). Run `esay-cloud-skills help` for the current `<target|all>` list; it is generated from `src/config.js`.

### What It Does

- Detects common local skills directories
- Creates a shared iCloud storage layout
- Migrates existing local skill folders into iCloud
- Replaces local directories with symlinks
- Verifies that links still point at the expected destination
- Reports missing paths, broken links, and unmanaged folders

### Usage (CLI)

Run directly with Node:

```bash
node ./src/cli.js scan
node ./src/cli.js setup
node ./src/cli.js doctor
node ./src/cli.js link codex
node ./src/cli.js unlink codex
node ./src/cli.js restore codex
```

### Desktop App

The project includes a Tauri desktop shell. The **only** UI sources used by Tauri live under `frontend/` (static `index.html`, `frontend/ui/*`).

The desktop shell runs the same Node CLI as the command line. **You still need Node.js installed and on `PATH`** for the bundled app to work. Release builds ship a copy of `src/*.js` inside the app’s Resources folder (`cli/`), so the app does not depend on your project checkout path.

To run the desktop app in development:

```bash
npm install
npm run tauri:dev
```

To build a macOS app bundle:

```bash
npm run tauri:build
```

The desktop “More” menu supports **link with copy** (same as `link --copy`) and **reset default config** (same as `init-config`).

### Commands
- `scan`: Detects known local paths and shows their status.
- `setup`: Initializes the config file and shared iCloud directory structure.
- `init-config`: Writes a fresh default `config.json` (overwrites the existing file at the standard path).
- `link <target> [--copy]`: Replaces the local folder with a symlink into iCloud. **By default** (no flag) the app **moves** your existing local skills directory into the iCloud path with a single `rename` on the same volume—**no full-file duplicate** (like Finder “move”). Use **`--copy`** only if you want the old behavior: copy into iCloud and keep a `…/skills.backup-*` folder (enables `restore` to that backup). If local and iCloud are on **different volumes**, a one-time copy is still required; the temporary backup is then removed to avoid double disk use.
- `unlink <target>`: Removes the managed symlink for a target and recreates an empty local directory.
- `restore <target|all>`: Restores the most recent pre-link backup back to the local path. With `all`, each target is attempted independently: tools **without** a recorded backup are reported as **skipped** instead of failing the whole command.
- `restore-machine`: Restores this machine from the shared iCloud layout.
- `doctor`: Checks the current setup for missing paths, broken symlinks, etc. It also **warns** for each first-level **skill folder** (child directory) that is missing a `SKILL.md` file, following the same convention as many community tools (e.g. [reorx/skm](https://github.com/reorx/skm), [agentskills.io](https://agentskills.io/)).

### Related tools (not bundled)

- **[reorx/skm](https://github.com/reorx/skm)**: Install skills from GitHub or local paths into `~/.claude/skills`, etc., via a YAML config and per-skill symlinks.
- **[nnnggel/skills-management](https://github.com/nnnggel/skills-management)**: Broader “skills manager” with GitHub (including sparse checkout) and project-scoped links.
- **[yibie/skills-manager](https://github.com/yibie/skills-manager)**: Native macOS app for discover / install / test / manage across several agents.

**Esay Cloud Skills** focuses on **iCloud + per-tool root symlinks**; the `SKILL.md` checks above align with the same on-disk layout those tools expect. **Exception:** the `hermes` target uses a nested `category/…/skill/…/SKILL.md` layout; first-level `doctor` / table checks for `SKILL.md` are **skipped** for that tool to avoid false positives.
- `list-skills <target>`: Lists all skills in a specific target or all targets.
- `delete-skill <tool> <skill-name>`: Deletes a specific skill.
- `copy-skill <source-tool> <skill-name> <target-tool> [target-name]`: Copies a skill to another tool category.

### Tests

```bash
npm test
```

---


<a name="chinese"></a>
## 中文

`esay-cloud-skills` 是一个优先支持 macOS 的 CLI 和桌面应用，它可以帮助你将各个 AI 工具的 skills 管理在一个基于 iCloud 的统一位置，并通过软链接将本地的工具文件夹与该共享位置打通。

目前支持以下工具和特性（各分类有独立 iCloud 子目录，见下表）：
- 全局 **global**、**Codex**、**Claude Code**、**Cursor**、**Antigravity**
- **OpenCode**、**OpenClaw**、**Hermes**（Nous Research Hermes Agent）
- 提供 macOS 版本的 Tauri 桌面界面

### 技能分类（CLI 中的 `target`）

每个 **分类** 对应一个 CLI 的 target 名、iCloud 下 `AI-Skills` 的子目录名，以及应用会优先检测的本地路径。以下 **Key** 用于 `link <key>`、`list-skills <key>` 等命令。路径与各产品公开文档一致（约 2025–2026）。

| Key | 产品 | 作用 | 默认会检测的本地路径 | iCloud 中目录名 |
| --- | --- | --- | --- | --- |
| `global` | 通用 / 多工具 | 不绑定单一产品的共享 skills | `~/.agent/skills` | `…/AI-Skills/global` |
| `codex` | Codex | 仅给 Codex 用 | `~/.codex/skills` | `…/AI-Skills/codex` |
| `claude` | Claude Code | 仅给 Claude Code 用 | 优先 `~/.claude/skills`，也尝试 `~/.claude-code/…` 与 `~/.config/claude-code/…` | `…/AI-Skills/claude-code` |
| `antigravity` | Antigravity | 仅给 Antigravity 用 | `~/.antigravity/skills`（或 `~/.config/antigravity/…`） | `…/AI-Skills/antigravity` |
| `cursor` | Cursor | Cursor 用户级 skills | `~/.cursor/skills`，或存在时 `~/.agents/skills` | `…/AI-Skills/cursor` |
| `opencode` | [OpenCode](https://opencode.ai/docs/skills) | OpenCode 用户级 skills | `~/.config/opencode/skills` | `…/AI-Skills/opencode` |
| `openclaw` | [OpenClaw](https://docs.openclaw.ai/tools/skills) | OpenClaw 托管 / 本机覆写用 skills | `~/.openclaw/skills`（与 `~/.agents/skills` 共存，优先级以官方文档为准） | `…/AI-Skills/openclaw` |
| `hermes` | [Hermes Agent](https://hermes-agent.nousresearch.com/docs/user-guide/features/skills/) | Hermes 主 skills 目录 | `~/.hermes/skills` | `…/AI-Skills/hermes` |

在支持 `all` 的命令中可使用 `all` 表示全体分类（如 `list-skills all`、`link all`）。完整 target 列表以 `esay-cloud-skills help` 与 `src/config.js` 为准。

### 核心功能

- 自动检测常见的本地 skills 目录
- 在 iCloud 中创建共享的存储结构
- 将现有的本地 skills 文件夹迁移至 iCloud
- 使用软链接替换本地的真实目录
- 校验现有链接是否正确指向目标位置
- 扫描并报告丢失的路径、损坏的链接以及未接管的真实文件夹

### CLI 使用方法

使用 Node 直接运行：

```bash
node ./src/cli.js scan
node ./src/cli.js setup
node ./src/cli.js doctor
node ./src/cli.js link codex
node ./src/cli.js unlink codex
node ./src/cli.js restore codex
```

### 桌面端应用

本项目包含一个 Tauri 桌面壳。Tauri 实际加载的静态界面**仅**在 `frontend/` 目录（`index.html` 与 `frontend/ui/*`）。

桌面端通过 Node 调用与 CLI 相同的逻辑，因此本机仍需安装 **Node.js 且可在 `PATH` 中找到 `node`**。正式打包的应用会把 `src/*.js` 复制到应用包 Resources 下的 `cli/` 目录，不再依赖你本机上的仓库路径。

在开发环境中运行桌面端：

```bash
npm install
npm run tauri:dev
```

打包构建 macOS 应用：

```bash
npm run tauri:build
```

桌面端「更多」菜单中支持 **勾选后按复制方式接入**（等同 `link --copy`）以及 **重置默认配置**（等同 `init-config`）。

### 命令一览
- `scan`: 检测已知的本地路径并显示其当前状态。
- `setup`: 初始化配置文件及 iCloud 共享目录结构。
- `init-config`：写入一份新的默认 `config.json`（会覆盖标准路径下的现有文件）。
- `link <target> [--copy]`：把本地路径改为指向 iCloud 的软链接。**默认**（不加参数）在本机与 iCloud 在同一磁盘时，用**整目录移动**（`rename`）进 iCloud，**不会把整份数据再复制一份**；需要旧版「复制到 iCloud + 保留 `…/skills.backup-*` 以便 `restore`」时，请加 **`--copy`**。若本机与 iCloud 不在同一卷，仍可能需一次复制，复制后会删掉临时目录以免长期占双倍空间。
- `unlink <target>`: 移除指定工具的软链接，并在本地重新创建一个空文件夹。
- `restore <target|all>`: 将最后一次建立链接前的备份恢复到本地路径。使用 `all` 时对每个分类单独尝试：没有记录备份的分类会标记为 **skipped**，不会让整个命令失败。
- `restore-machine`: 根据 iCloud 中的共享结构恢复当前机器的技能目录。
- `doctor`：检查路径、软链等；并对每个**一级 skill 子目录**检查是否含 **`SKILL.md`**，与社区常见约定（如 [reorx/skm](https://github.com/reorx/skm)、[agentskills.io](https://agentskills.io/)）一致，缺少时给出 **warn**。

### 相关项目（本仓库不内置）

- **[reorx/skm](https://github.com/reorx/skm)**：用 YAML 配置，从 GitHub/本地把各 skill 软链到 `~/.claude/skills` 等。
- **[nnnggel/skills-management](https://github.com/nnnggel/skills-management)**：带 GitHub（含 sparse）、项目级链等能力。
- **[yibie/skills-manager](https://github.com/yibie/skills-manager)**：macOS 原生，偏发现/安装/沙箱测试/多代理管理。

**Esay Cloud Skills** 侧重 **iCloud + 按工具根目录软链**；`SKILL.md` 检查与这些工具期望的目录结构一致。**例外**：`hermes` 为多层 `分类/…/技能/SKILL.md` 结构，对其**不做**根目录下逐文件夹的 `SKILL.md` 强校验，以免误报。
- `list-skills <target>`: 列出特定目标或所有目标中的所有 skills。
- `delete-skill <tool> <skill-name>`: 删除某个特定的 skill。
- `copy-skill <source-tool> <skill-name> <target-tool> [target-name]`: 将一个 skill 复制到其他工具分类下。

### 测试

```bash
npm test
```

