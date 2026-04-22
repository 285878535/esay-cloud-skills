# Skills Manager

`skills-manager` is a small macOS-first CLI that helps you keep AI tool skills in one iCloud-backed location and wire local tool folders to that shared source with symlinks.

It currently supports a practical MVP for:

- Codex
- Claude Code
- Antigravity
- A shared global skills directory
- A Tauri desktop shell for macOS

## What It Does

- Detects common local skills directories
- Creates a shared iCloud storage layout
- Migrates existing local skill folders into iCloud
- Replaces local directories with symlinks
- Verifies that links still point at the expected destination
- Reports missing paths, broken links, and unmanaged folders

## Storage Layout

By default, the shared iCloud root is:

`~/Library/Mobile Documents/com~apple~CloudDocs/AI-Skills`

Inside that root, the tool creates:

- `global/`
- `codex/`
- `claude-code/`
- `antigravity/`

## Supported Local Paths

The CLI scans a conservative set of common locations:

- `~/.codex/skills`
- `~/.agent/skills`
- `~/.claude/skills`
- `~/.claude-code/skills`
- `~/.config/claude-code/skills`
- `~/.antigravity/skills`
- `~/.config/antigravity/skills`

You can also add custom paths in the config file after the first run.

## Usage

Run directly with Node:

```bash
node ./src/cli.js scan
node ./src/cli.js setup
node ./src/cli.js doctor
node ./src/cli.js link codex
node ./src/cli.js unlink codex
node ./src/cli.js restore codex
```

Or make it executable and use the binary name:

```bash
chmod +x ./src/cli.js
./src/cli.js scan
```

## Desktop App

The project now includes a Tauri desktop shell in [src-tauri/src/main.rs](/Users/jiaxingxing/Documents/New%20project/src-tauri/src/main.rs:1) with a static frontend in:

- [index.html](/Users/jiaxingxing/Documents/New%20project/index.html:1)
- [ui/app.js](/Users/jiaxingxing/Documents/New%20project/ui/app.js:1)
- [ui/styles.css](/Users/jiaxingxing/Documents/New%20project/ui/styles.css:1)

To run the desktop app in development:

```bash
npm install
npm run tauri:dev
```

To build a macOS app bundle:

```bash
npm run tauri:build
```

Right now the Tauri backend calls the existing Node CLI under the hood, which keeps the app logic shared with the terminal workflow.

## Commands

### `scan`

Detects known local paths and shows which ones exist, are missing, or are already symlinked.

### `setup`

Initializes the config file and shared iCloud directory structure.

### `link <target>`

Migrates a target directory into iCloud and replaces the local folder with a symlink.

Targets:

- `global`
- `codex`
- `claude`
- `antigravity`
- `all`

### `doctor`

Checks the current setup for:

- missing iCloud targets
- broken symlinks
- unmanaged real directories
- disabled tools in config

### Desktop UI

The app provides:

- an overview card for each tool target
- one-click `setup`, `scan`, `doctor`
- one-click `link`, `unlink`, `restore` per tool
- bulk actions for all tools
- a doctor panel and activity log

### `unlink <target>`

Removes the managed symlink for a target and recreates an empty local directory so the tool can run without the shared link.

This does not delete the iCloud copy.

### `restore <target>`

Restores the most recent pre-link backup back to the local path.

This is useful if you want to undo a migration and go back to the original local folder content.

## Config

The config file lives at:

`~/.skills-manager/config.json`

It stores:

- iCloud root
- enabled tools
- local path candidates
- preferred target mapping

## Safety

When `link` migrates an existing real directory, it first moves it to a timestamped backup next to the original folder before creating the symlink.

`restore` only restores from the recorded backup path stored in `~/.skills-manager/config.json`, and it refuses to overwrite a non-empty local directory.

## Notes

- This tool is designed for macOS and assumes iCloud Drive is enabled.
- If multiple Macs edit the same skill at once, iCloud may create conflict copies.
- Some tools may require restart after relinking their skills directory.
- The current desktop app scaffold expects `node` to be available on the machine because it reuses the CLI for backend actions.
