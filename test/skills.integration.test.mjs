import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";

test("restore all skips tools without backup", async () => {
  const tmp = await mkdtemp(path.join(os.tmpdir(), "ecs-restore-all-"));
  process.env.HOME = tmp;

  const { createDefaultConfig, saveConfig } = await import("../src/config.js");
  const { restoreAllTargets } = await import("../src/skills.js");

  const config = createDefaultConfig();
  config.iCloudRoot = path.join(tmp, "AI-Skills");
  await saveConfig(config);

  const results = await restoreAllTargets(config);
  assert.equal(results.length, Object.keys(config.tools).length);

  for (const r of results) {
    assert.equal(r.skipped, true);
    assert.ok(typeof r.message === "string" && r.message.length > 0);
    assert.ok("tool" in r);
  }
});

test("getCliTargetAlts lists all keys and all", async () => {
  const tmp = await mkdtemp(path.join(os.tmpdir(), "ecs-cli-alts-"));
  process.env.HOME = tmp;
  const { getCliTargetAlts, getToolKeys } = await import("../src/config.js");
  const keys = getToolKeys();
  const alts = getCliTargetAlts();
  for (const k of keys) {
    assert.ok(alts.includes(k), `missing ${k} in ${alts}`);
  }
  assert.ok(alts.endsWith("|all") || alts.includes("|all"));
});
