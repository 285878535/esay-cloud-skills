import path from "node:path";
import { cp, lstat, mkdir, opendir, readlink, rename, rm, stat, symlink, unlink } from "node:fs/promises";

function timestamp() {
  return new Date().toISOString().replaceAll(":", "-");
}

async function exists(targetPath) {
  try {
    await lstat(targetPath);
    return true;
  } catch (error) {
    if (error.code === "ENOENT") {
      return false;
    }

    throw error;
  }
}

async function isEmptyDirectory(targetPath) {
  const info = await pathInfo(targetPath);

  if (!info.isDirectory) {
    return false;
  }

  const directory = await opendir(targetPath);
  const entry = await directory.read();
  await directory.close();
  return entry === null;
}

async function pathInfo(targetPath) {
  try {
    const stats = await lstat(targetPath);
    return {
      exists: true,
      isSymbolicLink: stats.isSymbolicLink(),
      isDirectory: stats.isDirectory(),
    };
  } catch (error) {
    if (error.code === "ENOENT") {
      return {
        exists: false,
        isSymbolicLink: false,
        isDirectory: false,
      };
    }

    throw error;
  }
}

async function countEntries(targetPath) {
  let count = 0;
  const directory = await opendir(targetPath);

  for await (const _entry of directory) {
    count += 1;
  }

  return count;
}

async function hasEntries(targetPath) {
  return (await countEntries(targetPath)) > 0;
}

function resolveTool(config, toolName) {
  const tool = config.tools[toolName];

  if (!tool) {
    throw new Error(`Unknown tool target: ${toolName}`);
  }

  return tool;
}

async function pickLocalPath(tool) {
  for (const candidate of tool.candidates) {
    if (await exists(candidate)) {
      return candidate;
    }
  }

  return tool.candidates[0];
}

function getICloudPath(config, tool) {
  return path.join(config.iCloudRoot, tool.bucket);
}

async function ensureParent(targetPath) {
  await mkdir(path.dirname(targetPath), { recursive: true });
}

async function ensureDirectory(targetPath) {
  await mkdir(targetPath, { recursive: true });
}

async function ensureNoConflicts(sourceDir, destinationDir) {
  const directory = await opendir(sourceDir);

  for await (const entry of directory) {
    const destinationPath = path.join(destinationDir, entry.name);

    if (await exists(destinationPath)) {
      throw new Error(
        `Refusing to overwrite existing iCloud entry: ${destinationPath}. Move or rename it first.`,
      );
    }
  }
}

async function backupDirectory(localPath) {
  const backupPath = `${localPath}.backup-${timestamp()}`;
  await rename(localPath, backupPath);
  return backupPath;
}

/**
 * @param {string} dirPath
 * @returns {Promise<boolean>} true if directory exists and has at least one entry
 */
async function isNonEmptyDirectory(dirPath) {
  const p = await pathInfo(dirPath);
  if (!p.isDirectory) {
    return false;
  }
  return (await countEntries(dirPath)) > 0;
}

function updateToolState(tool, values) {
  tool.state = {
    ...tool.state,
    ...values,
  };
}

async function resolveToolPaths(config, toolName) {
  const tool = resolveTool(config, toolName);
  const localPath = await pickLocalPath(tool);
  const iCloudPath = getICloudPath(config, tool);
  const localInfo = await pathInfo(localPath);
  const iCloudInfo = await pathInfo(iCloudPath);

  let activePath = null;
  let source = "missing";

  if (localInfo.isSymbolicLink) {
    const currentTarget = await readlink(localPath);
    const resolvedTarget = path.resolve(path.dirname(localPath), currentTarget);
    activePath = resolvedTarget;
    source = resolvedTarget === iCloudPath ? "icloud" : "local";
  } else if (localInfo.isDirectory) {
    activePath = localPath;
    source = "local";
  } else if (iCloudInfo.isDirectory) {
    activePath = iCloudPath;
    source = "icloud";
  }

  return {
    tool,
    localPath,
    iCloudPath,
    activePath,
    source,
    localInfo,
    iCloudInfo,
  };
}

/**
 * Conventional “agent skills” (see agentskills.io) expect each skill folder to contain a SKILL.md.
 * Same idea as tools like reorx/skm which detect valid skills via SKILL.md.
 */
async function directoryHasSkillMd(dirPath) {
  return exists(path.join(dirPath, "SKILL.md"));
}

async function listImmediateEntries(rootPath) {
  const results = [];
  const directory = await opendir(rootPath);

  for await (const entry of directory) {
    const fullPath = path.join(rootPath, entry.name);
    const stats = await lstat(fullPath);
    let follow;
    try {
      follow = await stat(fullPath);
    } catch {
      follow = null;
    }
    const isDir = follow != null && follow.isDirectory();
    const hasSkillMd = isDir && (await directoryHasSkillMd(fullPath));
    const mtimeSource = follow && follow.mtime != null ? follow : stats;

    results.push({
      name: entry.name,
      path: fullPath,
      kind: isDir ? "directory" : "file",
      isSymlink: stats.isSymbolicLink(),
      hasSkillMd,
      modifiedAt: mtimeSource.mtime.toISOString(),
    });
  }

  results.sort((a, b) => a.name.localeCompare(b.name));
  return results;
}

export async function ensureICloudLayout(config) {
  await ensureDirectory(config.iCloudRoot);

  for (const tool of Object.values(config.tools)) {
    await ensureDirectory(getICloudPath(config, tool));
  }
}

export async function detectTargets(config) {
  const results = [];

  for (const [toolName, tool] of Object.entries(config.tools)) {
    const localPath = await pickLocalPath(tool);
    const iCloudPath = getICloudPath(config, tool);
    const info = await pathInfo(localPath);

    let status = "missing";
    let details = "";

    if (info.isSymbolicLink) {
      const target = await readlink(localPath);
      status = "symlinked";
      details = `target=${target}`;
    } else if (info.isDirectory) {
      const entries = await countEntries(localPath);
      status = "directory";
      details = `entries=${entries}`;
    }

    results.push({
      tool: toolName,
      localPath,
      iCloudPath,
      status,
      details,
      lastBackupPath: tool.state?.lastBackupPath ?? null,
      lastLinkedAt: tool.state?.lastLinkedAt ?? null,
    });
  }

  return results;
}

export async function listSkills(config, toolName) {
  const { activePath, iCloudPath, localPath, source } = await resolveToolPaths(config, toolName);

  if (!activePath) {
    return {
      tool: toolName,
      source,
      rootPath: iCloudPath,
      localPath,
      iCloudPath,
      items: [],
    };
  }

  return {
    tool: toolName,
    source,
    rootPath: activePath,
    localPath,
    iCloudPath,
    items: await listImmediateEntries(activePath),
  };
}

export async function listAllSkills(config) {
  const results = [];

  for (const toolName of Object.keys(config.tools)) {
    results.push(await listSkills(config, toolName));
  }

  return results;
}

export async function deleteSkill(config, toolName, skillName) {
  const listing = await listSkills(config, toolName);
  const skill = listing.items.find((item) => item.name === skillName);

  if (!skill) {
    throw new Error(`Skill not found in ${toolName}: ${skillName}`);
  }

  await rm(skill.path, { recursive: true, force: true });

  return {
    tool: toolName,
    message: `Deleted ${skillName} from ${toolName}.`,
    path: skill.path,
  };
}

export async function copySkill(config, sourceToolName, skillName, targetToolName, targetName = skillName) {
  const sourceListing = await listSkills(config, sourceToolName);
  const sourceSkill = sourceListing.items.find((item) => item.name === skillName);

  if (!sourceSkill) {
    throw new Error(`Skill not found in ${sourceToolName}: ${skillName}`);
  }

  const targetPaths = await resolveToolPaths(config, targetToolName);
  const targetRoot = targetPaths.iCloudPath;
  const targetPath = path.join(targetRoot, targetName);

  await ensureDirectory(targetRoot);

  if (await exists(targetPath)) {
    throw new Error(`Target skill already exists: ${targetPath}`);
  }

  await cp(sourceSkill.path, targetPath, { recursive: true });

  return {
    tool: targetToolName,
    message: `Copied ${skillName} from ${sourceToolName} to ${targetToolName}.`,
    path: targetPath,
  };
}

/**
 * @param {{ dataMode?: "move" | "copy" }} [options] `move` (default): move local data into the iCloud folder with `rename` when on the same volume (no full-file copy). `copy`: always copy, keep a .backup-… duplicate like before.
 */
export async function linkTarget(config, toolName, options = {}) {
  const dataMode = options.dataMode === "copy" ? "copy" : "move";

  const tool = resolveTool(config, toolName);

  if (!tool.enabled) {
    return {
      tool: toolName,
      message: "Skipped because it is disabled in config.",
    };
  }

  const localPath = await pickLocalPath(tool);
  const iCloudPath = getICloudPath(config, tool);
  const info = await pathInfo(localPath);

  await ensureDirectory(iCloudPath);
  await ensureParent(localPath);

  if (info.isSymbolicLink) {
    const currentTarget = await readlink(localPath);
    if (path.resolve(path.dirname(localPath), currentTarget) === iCloudPath) {
      updateToolState(tool, {
        lastLinkedPath: localPath,
        lastICloudPath: iCloudPath,
      });
      return {
        tool: toolName,
        message: "Already linked to iCloud.",
      };
    }

    throw new Error(`${localPath} is already a symlink to ${currentTarget}.`);
  }

  if (info.isDirectory) {
    const backupPath = await backupDirectory(localPath);
    await ensureNoConflicts(backupPath, iCloudPath);

    if (dataMode === "move") {
      if (await isNonEmptyDirectory(iCloudPath)) {
        await cp(backupPath, iCloudPath, { recursive: true });
        await rm(backupPath, { recursive: true, force: true });
        await symlink(iCloudPath, localPath);
        updateToolState(tool, {
          lastLinkedPath: localPath,
          lastBackupPath: null,
          lastICloudPath: iCloudPath,
          lastLinkedAt: new Date().toISOString(),
        });
        return {
          tool: toolName,
          message: `Merged your local skills into the existing iCloud directory (iCloud was not empty), then linked. No duplicate backup was kept in your home directory.`,
        };
      }

      await rm(iCloudPath, { recursive: true, force: true });
      try {
        await rename(backupPath, iCloudPath);
      } catch (error) {
        if (error && error.code === "EXDEV") {
          await ensureDirectory(iCloudPath);
          await cp(backupPath, iCloudPath, { recursive: true });
          await rm(backupPath, { recursive: true, force: true });
          await symlink(iCloudPath, localPath);
          updateToolState(tool, {
            lastLinkedPath: localPath,
            lastBackupPath: null,
            lastICloudPath: iCloudPath,
            lastLinkedAt: new Date().toISOString(),
          });
          return {
            tool: toolName,
            message: `Linked after copying: local and iCloud live on different volumes, so a one-time copy was required (the temporary backup folder was then removed to avoid double disk use).`,
          };
        }
        throw error;
      }

      await symlink(iCloudPath, localPath);
      updateToolState(tool, {
        lastLinkedPath: localPath,
        lastBackupPath: null,
        lastICloudPath: iCloudPath,
        lastLinkedAt: new Date().toISOString(),
      });
      return {
        tool: toolName,
        message: `Moved the existing directory into iCloud in place and linked (no full duplicate copy; same as Finder move on one disk). Unlink/restore from “last backup” is not available for this link.`,
      };
    }

    await cp(backupPath, iCloudPath, { recursive: true });
    await symlink(iCloudPath, localPath);
    updateToolState(tool, {
      lastLinkedPath: localPath,
      lastBackupPath: backupPath,
      lastICloudPath: iCloudPath,
      lastLinkedAt: new Date().toISOString(),
    });
    return {
      tool: toolName,
      message: `Copied existing directory to iCloud (--copy), linked it, and kept a backup at ${backupPath}.`,
    };
  }

  await symlink(iCloudPath, localPath);
  updateToolState(tool, {
    lastLinkedPath: localPath,
    lastICloudPath: iCloudPath,
    lastLinkedAt: new Date().toISOString(),
  });
  return {
    tool: toolName,
    message: "Created a new symlink to iCloud.",
  };
}

/**
 * @param {{ dataMode?: "move" | "copy" }} [options]
 */
export async function linkAllTargets(config, options = {}) {
  const results = [];

  for (const toolName of Object.keys(config.tools)) {
    results.push(await linkTarget(config, toolName, options));
  }

  return results;
}

export async function relinkTargetFromICloud(config, toolName) {
  const tool = resolveTool(config, toolName);
  const localPath = await pickLocalPath(tool);
  const iCloudPath = getICloudPath(config, tool);
  const localInfo = await pathInfo(localPath);
  const iCloudInfo = await pathInfo(iCloudPath);

  if (!iCloudInfo.isDirectory) {
    return {
      tool: toolName,
      message: `Skipped because iCloud directory does not exist: ${iCloudPath}`,
    };
  }

  await ensureParent(localPath);

  if (localInfo.isSymbolicLink) {
    const currentTarget = await readlink(localPath);
    const resolvedTarget = path.resolve(path.dirname(localPath), currentTarget);
    if (resolvedTarget === iCloudPath) {
      return {
        tool: toolName,
        message: "Already linked to the shared iCloud directory.",
      };
    }

    throw new Error(`Refusing to relink ${localPath} because it already points to ${resolvedTarget}.`);
  }

  if (localInfo.isDirectory) {
    if (await isEmptyDirectory(localPath)) {
      await rm(localPath, { recursive: true, force: true });
      await symlink(iCloudPath, localPath);
      updateToolState(tool, {
        lastLinkedPath: localPath,
        lastICloudPath: iCloudPath,
        lastLinkedAt: new Date().toISOString(),
      });
      return {
        tool: toolName,
        message: `Linked empty local directory to iCloud: ${localPath}`,
      };
    }

    const backupPath = await backupDirectory(localPath);
    await symlink(iCloudPath, localPath);
    updateToolState(tool, {
      lastLinkedPath: localPath,
      lastBackupPath: backupPath,
      lastICloudPath: iCloudPath,
      lastLinkedAt: new Date().toISOString(),
    });
    return {
      tool: toolName,
      message: `Backed up local directory to ${backupPath} and linked ${localPath} to iCloud.`,
    };
  }

  await symlink(iCloudPath, localPath);
  updateToolState(tool, {
    lastLinkedPath: localPath,
    lastICloudPath: iCloudPath,
    lastLinkedAt: new Date().toISOString(),
  });
  return {
    tool: toolName,
    message: `Linked missing local path to iCloud: ${localPath}`,
  };
}

export async function relinkAllFromICloud(config) {
  const results = [];

  for (const toolName of Object.keys(config.tools)) {
    results.push(await relinkTargetFromICloud(config, toolName));
  }

  return results;
}

export async function unlinkTarget(config, toolName) {
  const tool = resolveTool(config, toolName);
  const localPath = await pickLocalPath(tool);
  const iCloudPath = getICloudPath(config, tool);
  const info = await pathInfo(localPath);

  if (!info.exists) {
    return {
      tool: toolName,
      message: `Nothing to unlink. Local path is missing: ${localPath}`,
    };
  }

  if (!info.isSymbolicLink) {
    return {
      tool: toolName,
      message: `Skipped. Local path is not a symlink: ${localPath}`,
    };
  }

  const currentTarget = await readlink(localPath);
  const resolvedTarget = path.resolve(path.dirname(localPath), currentTarget);

  if (resolvedTarget !== iCloudPath) {
    throw new Error(
      `Refusing to unlink ${localPath} because it points to ${resolvedTarget}, not the managed iCloud path.`,
    );
  }

  await unlink(localPath);
  await mkdir(localPath, { recursive: true });
  updateToolState(tool, {
    lastLinkedPath: localPath,
    lastICloudPath: iCloudPath,
  });

  return {
    tool: toolName,
    message: `Removed the symlink and recreated an empty local directory at ${localPath}.`,
  };
}

export async function unlinkAllTargets(config) {
  const results = [];

  for (const toolName of Object.keys(config.tools)) {
    results.push(await unlinkTarget(config, toolName));
  }

  return results;
}

export async function restoreTarget(config, toolName) {
  const tool = resolveTool(config, toolName);
  const localPath = await pickLocalPath(tool);
  const backupPath = tool.state?.lastBackupPath;

  if (!backupPath) {
    throw new Error(`No backup recorded for ${toolName}.`);
  }

  if (!(await exists(backupPath))) {
    throw new Error(`Recorded backup does not exist: ${backupPath}`);
  }

  const info = await pathInfo(localPath);

  if (info.isSymbolicLink) {
    await unlink(localPath);
  } else if (info.isDirectory) {
    if (!(await isEmptyDirectory(localPath))) {
      throw new Error(`Refusing to restore over a non-empty directory: ${localPath}`);
    }
    await rm(localPath, { recursive: true, force: true });
  } else if (info.exists) {
    throw new Error(`Refusing to restore because local path is not a directory or symlink: ${localPath}`);
  }

  await rename(backupPath, localPath);
  updateToolState(tool, {
    lastRestoredAt: new Date().toISOString(),
    lastLinkedPath: localPath,
  });

  return {
    tool: toolName,
    message: `Restored the last backup to ${localPath}.`,
  };
}

export async function restoreAllTargets(config) {
  const results = [];

  for (const toolName of Object.keys(config.tools)) {
    results.push(await restoreTarget(config, toolName));
  }

  return results;
}

async function appendSkillSpecWarnings(issues, toolName, rootPath) {
  if (toolName === "hermes") {
    return;
  }
  if (!rootPath || !(await exists(rootPath))) {
    return;
  }

  let list;
  try {
    list = await listImmediateEntries(rootPath);
  } catch {
    return;
  }

  for (const item of list) {
    if (item.kind !== "directory" || item.hasSkillMd) {
      continue;
    }

    issues.push({
      severity: "warn",
      tool: toolName,
      message: `Skill folder "${item.name}" has no SKILL.md (conventional layout). ${item.path}`,
    });
  }
}

export async function runDoctor(config) {
  const issues = [];

  for (const [toolName, tool] of Object.entries(config.tools)) {
    const localPath = await pickLocalPath(tool);
    const iCloudPath = getICloudPath(config, tool);
    const local = await pathInfo(localPath);
    const cloud = await pathInfo(iCloudPath);

    if (!tool.enabled) {
      issues.push({
        severity: "info",
        tool: toolName,
        message: "Disabled in config.",
      });
      continue;
    }

    if (!cloud.exists) {
      issues.push({
        severity: "error",
        tool: toolName,
        message: `Missing iCloud directory: ${iCloudPath}`,
      });
    }

    if (!local.exists) {
      issues.push({
        severity: "warn",
        tool: toolName,
        message: `Missing local path: ${localPath}`,
      });
      if (tool.state?.lastBackupPath && !(await exists(tool.state.lastBackupPath))) {
        issues.push({
          severity: "warn",
          tool: toolName,
          message: `Recorded backup is missing: ${tool.state.lastBackupPath}`,
        });
      }
      continue;
    }

    if (local.isSymbolicLink) {
      const target = await readlink(localPath);
      const resolved = path.resolve(path.dirname(localPath), target);
      if (resolved !== iCloudPath) {
        issues.push({
          severity: "error",
          tool: toolName,
          message: `Symlink points to ${resolved} instead of ${iCloudPath}`,
        });
      } else {
        await appendSkillSpecWarnings(issues, toolName, iCloudPath);
      }
      continue;
    }

    if (local.isDirectory) {
      issues.push({
        severity: "warn",
        tool: toolName,
        message: `Local path is still a real directory and is not linked: ${localPath}`,
      });
      await appendSkillSpecWarnings(issues, toolName, localPath);
    }

    if (tool.state?.lastBackupPath && !(await exists(tool.state.lastBackupPath))) {
      issues.push({
        severity: "warn",
        tool: toolName,
        message: `Recorded backup is missing: ${tool.state.lastBackupPath}`,
      });
    }
  }

  return issues;
}
