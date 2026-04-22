import os from "node:os";
import path from "node:path";
import { mkdir, readFile, writeFile } from "node:fs/promises";

const HOME = os.homedir();
const CONFIG_DIR = path.join(HOME, ".esay-cloud-skills");
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
      cursor: toolConfig("cursor", "cursor", [
        path.join(HOME, ".cursor", "skills"),
        path.join(HOME, ".agents", "skills"),
      ]),
      opencode: toolConfig("opencode", "opencode", [
        path.join(HOME, ".config", "opencode", "skills"),
      ]),
      openclaw: toolConfig("openclaw", "openclaw", [
        path.join(HOME, ".openclaw", "skills"),
      ]),
      hermes: toolConfig("hermes", "hermes", [path.join(HOME, ".hermes", "skills")]),
    },
  };
}

/** @returns {string[]} Stable order matches `createDefaultConfig().tools` key order. */
export function getToolKeys() {
  return Object.keys(createDefaultConfig().tools);
}

/** For CLI help, e.g. `global|codex|...|all`. */
export function getCliTargetAlts() {
  return `${getToolKeys().join("|")}|all`;
}

export function mergeConfigWithDefaults(loaded) {
  const defaults = createDefaultConfig();
  const next = {
    ...loaded,
    iCloudRoot: loaded.iCloudRoot ?? defaults.iCloudRoot,
    tools: { ...loaded.tools },
  };
  let didAddTools = false;

  for (const [key, defTool] of Object.entries(defaults.tools)) {
    if (!next.tools[key]) {
      next.tools[key] = structuredClone(defTool);
      didAddTools = true;
    }
  }

  return { config: next, didAddTools };
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
  const { config } = mergeConfigWithDefaults(JSON.parse(content));
  return config;
}

export async function ensureConfig() {
  try {
    const raw = await readFile(CONFIG_PATH, "utf8");
    const { config, didAddTools } = mergeConfigWithDefaults(JSON.parse(raw));
    if (didAddTools) {
      await saveConfig(config);
    }
    return config;
  } catch (error) {
    if (error.code !== "ENOENT") {
      throw error;
    }

    const config = createDefaultConfig();
    await saveConfig(config);
    return config;
  }
}
