import os from "node:os";
import path from "node:path";
import { mkdir, readFile, writeFile } from "node:fs/promises";

const HOME = os.homedir();
const CONFIG_DIR = path.join(HOME, ".skills-manager");
const CONFIG_PATH = path.join(CONFIG_DIR, "config.json");
const DEFAULT_ICLOUD_ROOT = path.join(
  HOME,
  "Library",
  "Mobile Documents",
  "com~apple~CloudDocs",
  "AI-Skills",
);

function toolConfig(name, bucket, candidates) {
  return {
    name,
    enabled: true,
    bucket,
    candidates,
    state: {
      lastLinkedPath: null,
      lastBackupPath: null,
      lastICloudPath: null,
      lastLinkedAt: null,
      lastRestoredAt: null,
    },
  };
}

export function createDefaultConfig() {
  return {
    iCloudRoot: DEFAULT_ICLOUD_ROOT,
    tools: {
      global: toolConfig("global", "global", [
        path.join(HOME, ".agent", "skills"),
      ]),
      codex: toolConfig("codex", "codex", [
        path.join(HOME, ".codex", "skills"),
      ]),
      claude: toolConfig("claude", "claude-code", [
        path.join(HOME, ".claude", "skills"),
        path.join(HOME, ".claude-code", "skills"),
        path.join(HOME, ".config", "claude-code", "skills"),
      ]),
      antigravity: toolConfig("antigravity", "antigravity", [
        path.join(HOME, ".antigravity", "skills"),
        path.join(HOME, ".config", "antigravity", "skills"),
      ]),
    },
  };
}

export function getConfigPath() {
  return CONFIG_PATH;
}

export async function saveConfig(config) {
  await mkdir(CONFIG_DIR, { recursive: true });
  await writeFile(CONFIG_PATH, `${JSON.stringify(config, null, 2)}\n`, "utf8");
}

export async function loadConfig() {
  const content = await readFile(CONFIG_PATH, "utf8");
  return JSON.parse(content);
}

export async function ensureConfig() {
  try {
    return await loadConfig();
  } catch (error) {
    if (error.code !== "ENOENT") {
      throw error;
    }

    const config = createDefaultConfig();
    await saveConfig(config);
    return config;
  }
}
