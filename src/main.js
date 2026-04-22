import {
  createDefaultConfig,
  ensureConfig,
  getCliTargetAlts,
  getConfigPath,
  saveConfig,
} from "./config.js";
import {
  copySkill,
  deleteSkill,
  detectTargets,
  ensureICloudLayout,
  linkAllTargets,
  linkTarget,
  listAllSkills,
  listSkills,
  relinkAllFromICloud,
  restoreAllTargets,
  restoreTarget,
  runDoctor,
  unlinkAllTargets,
  unlinkTarget,
} from "./skills.js";

function printHelp() {
  const targets = getCliTargetAlts();
  console.log(`esay-cloud-skills

Usage:
  esay-cloud-skills scan
  esay-cloud-skills setup
  esay-cloud-skills link <${targets}> [--copy]
  esay-cloud-skills unlink <${targets}>
  esay-cloud-skills restore <${targets}>
  esay-cloud-skills restore-machine
  esay-cloud-skills list-skills <${targets}>
  esay-cloud-skills delete-skill <tool> <skill-name>
  esay-cloud-skills copy-skill <source-tool> <skill-name> <target-tool> [target-name]
  esay-cloud-skills doctor
  esay-cloud-skills config-path
  esay-cloud-skills help
`);
}

function parseArgv(argv) {
  const normalized = argv.filter((arg) => arg !== "--json");
  const json = normalized.length !== argv.length;
  return {
    argv: normalized,
    json,
  };
}

/** Parses args after the \`link\` command, e.g. \`['codex', '--copy']\`. Default \`dataMode\` is \`move\` (rename into iCloud, no full duplicate on same volume). */
function parseLinkArgv(argsAfterCommand) {
  let dataMode = "move";
  const positional = [];

  for (const a of argsAfterCommand) {
    if (a === "--copy" || a === "-c") {
      dataMode = "copy";
    } else if (a === "--move" || a === "-m") {
      dataMode = "move";
    } else if (a.startsWith("-")) {
      throw new Error(
        `Unknown link option: ${a}. Use --copy to keep a .backup-… copy and full duplicate, or default move (no extra copy on same volume).`,
      );
    } else {
      positional.push(a);
    }
  }

  return { target: positional[0] ?? null, dataMode };
}

function emit(value, json) {
  if (json) {
    console.log(JSON.stringify({ ok: true, ...value }));
  }
}

function printScan(results) {
  for (const result of results) {
    const line = [
      `[${result.tool}]`,
      result.status.toUpperCase(),
      `local=${result.localPath}`,
      `icloud=${result.iCloudPath}`,
    ];

    if (result.details) {
      line.push(result.details);
    }

    if (result.lastBackupPath) {
      line.push(`backup=${result.lastBackupPath}`);
    }

    if (result.lastLinkedAt) {
      line.push(`linkedAt=${result.lastLinkedAt}`);
    }

    console.log(line.join(" "));
  }
}

function printDoctor(report) {
  if (report.length === 0) {
    console.log("Healthy: no issues found.");
    return;
  }

  for (const item of report) {
    console.log(`[${item.severity}] [${item.tool}] ${item.message}`);
  }
}

export async function run(argv) {
  const parsed = parseArgv(argv);
  const [command = "help", arg, arg2, arg3, arg4] = parsed.argv;

  switch (command) {
    case "help":
      printHelp();
      return;
    case "config-path":
      console.log(getConfigPath());
      return;
    case "setup": {
      const config = await ensureConfig();
      await ensureICloudLayout(config);
      await saveConfig(config);
      const payload = {
        message: `Config ready at ${getConfigPath()}`,
        iCloudRoot: config.iCloudRoot,
      };
      emit(payload, parsed.json);
      if (!parsed.json) {
        console.log(payload.message);
        console.log(`iCloud root: ${config.iCloudRoot}`);
      }
      return;
    }
    case "scan": {
      const config = await ensureConfig();
      const results = await detectTargets(config);
      const payload = {
        iCloudRoot: config.iCloudRoot,
        results,
      };
      emit(payload, parsed.json);
      if (!parsed.json) {
        printScan(results);
      }
      return;
    }
    case "link": {
      const config = await ensureConfig();
      await ensureICloudLayout(config);

      const { target, dataMode } = parseLinkArgv(parsed.argv.slice(1));

      if (!target) {
        throw new Error(`Missing target. Use link <${getCliTargetAlts()}> [--copy].`);
      }

      if (target === "all") {
        const results = await linkAllTargets(config, { dataMode });
        const payload = {
          message: "Completed link all.",
          results,
        };
        emit(payload, parsed.json);
        if (!parsed.json) {
          for (const result of results) {
            console.log(`[${result.tool}] ${result.message}`);
          }
        }
        await saveConfig(config);
        return;
      }

      const result = await linkTarget(config, target, { dataMode });
      emit(result, parsed.json);
      if (!parsed.json) {
        console.log(`[${result.tool}] ${result.message}`);
      }
      await saveConfig(config);
      return;
    }
    case "unlink": {
      const config = await ensureConfig();

      if (!arg) {
        throw new Error(`Missing target. Use unlink <${getCliTargetAlts()}>.`);
      }

      if (arg === "all") {
        const results = await unlinkAllTargets(config);
        const payload = {
          message: "Completed unlink all.",
          results,
        };
        emit(payload, parsed.json);
        if (!parsed.json) {
          for (const result of results) {
            console.log(`[${result.tool}] ${result.message}`);
          }
        }
        await saveConfig(config);
        return;
      }

      const result = await unlinkTarget(config, arg);
      emit(result, parsed.json);
      if (!parsed.json) {
        console.log(`[${result.tool}] ${result.message}`);
      }
      await saveConfig(config);
      return;
    }
    case "restore": {
      const config = await ensureConfig();

      if (!arg) {
        throw new Error(`Missing target. Use restore <${getCliTargetAlts()}>.`);
      }

      if (arg === "all") {
        const results = await restoreAllTargets(config);
        const payload = {
          message: "Completed restore all.",
          results,
        };
        emit(payload, parsed.json);
        if (!parsed.json) {
          for (const result of results) {
            console.log(`[${result.tool}] ${result.message}`);
          }
        }
        await saveConfig(config);
        return;
      }

      const result = await restoreTarget(config, arg);
      emit(result, parsed.json);
      if (!parsed.json) {
        console.log(`[${result.tool}] ${result.message}`);
      }
      await saveConfig(config);
      return;
    }
    case "restore-machine": {
      const config = await ensureConfig();
      await ensureICloudLayout(config);
      const results = await relinkAllFromICloud(config);
      const payload = {
        message: "Restored this machine from the shared iCloud layout.",
        results,
      };
      emit(payload, parsed.json);
      if (!parsed.json) {
        for (const result of results) {
          console.log(`[${result.tool}] ${result.message}`);
        }
      }
      await saveConfig(config);
      return;
    }
    case "doctor": {
      const config = await ensureConfig();
      const report = await runDoctor(config);
      const payload = {
        issues: report,
      };
      emit(payload, parsed.json);
      if (!parsed.json) {
        printDoctor(report);
      }
      return;
    }
    case "list-skills": {
      const config = await ensureConfig();

      if (!arg) {
        throw new Error(`Missing target. Use list-skills <${getCliTargetAlts()}>.`);
      }

      if (arg === "all") {
        const results = await listAllSkills(config);
        const payload = { results };
        emit(payload, parsed.json);
        if (!parsed.json) {
          console.log(JSON.stringify(results, null, 2));
        }
        return;
      }

      const result = await listSkills(config, arg);
      emit(result, parsed.json);
      if (!parsed.json) {
        console.log(JSON.stringify(result, null, 2));
      }
      return;
    }
    case "delete-skill": {
      const config = await ensureConfig();

      if (!arg || !arg2) {
        throw new Error("Missing arguments. Use delete-skill <tool> <skill-name>.");
      }

      const result = await deleteSkill(config, arg, arg2);
      emit(result, parsed.json);
      if (!parsed.json) {
        console.log(result.message);
      }
      return;
    }
    case "copy-skill": {
      const config = await ensureConfig();

      if (!arg || !arg2 || !arg3) {
        throw new Error("Missing arguments. Use copy-skill <source-tool> <skill-name> <target-tool> [target-name].");
      }

      const result = await copySkill(config, arg, arg2, arg3, arg4 ?? arg2);
      emit(result, parsed.json);
      if (!parsed.json) {
        console.log(result.message);
      }
      return;
    }
    case "init-config": {
      const config = createDefaultConfig();
      await saveConfig(config);
      const payload = {
        message: `Created default config at ${getConfigPath()}`,
      };
      emit(payload, parsed.json);
      if (!parsed.json) {
        console.log(payload.message);
      }
      return;
    }
    default:
      printHelp();
      throw new Error(`Unknown command: ${command}`);
  }
}
