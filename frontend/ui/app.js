const invoke = window.__TAURI__?.core?.invoke;
const doc = document.documentElement;

const elements = {
  tabs: document.querySelector("#tool-tabs"),
  pathBadge: document.querySelector("#path-badge"),
  title: document.querySelector("#current-tool-title"),
  description: document.querySelector("#current-tool-description"),
  syncHint: document.querySelector("#sync-hint"),
  statusText: document.querySelector("#status-text"),
  countText: document.querySelector("#count-text"),
  tableBody: document.querySelector("#skills-table-body"),
  emptyState: document.querySelector("#empty-state"),
  template: document.querySelector("#skill-row-template"),
  setupButton: document.querySelector("#setup-button"),
  restoreMachineButton: document.querySelector("#restore-machine-button"),
  refreshButton: document.querySelector("#refresh-button"),
  linkButton: document.querySelector("#link-button"),
  unlinkButton: document.querySelector("#unlink-button"),
  restoreButton: document.querySelector("#restore-button"),
  openLocalButton: document.querySelector("#open-local-button"),
  openICloudButton: document.querySelector("#open-icloud-button"),
  moreButton: document.querySelector("#more-button"),
  morePanel: document.querySelector("#more-panel"),
  zhButton: document.querySelector("#lang-zh"),
  enButton: document.querySelector("#lang-en"),
};

const TOOL_ORDER = [
  "global",
  "codex",
  "claude",
  "antigravity",
  "cursor",
  "opencode",
  "openclaw",
  "hermes",
];

const translations = {
  zh: {
    title: "Esay Cloud Skills",
    setupButton: "初始化 iCloud",
    restoreMachineButton: "恢复本机环境",
    refreshButton: "刷新",
    moreButton: "更多",
    linkButton: "接入",
    unlinkButton: "取消接入",
    restoreButton: "恢复备份",
    openLocalButton: "打开本地目录",
    openICloudButton: "打开 iCloud 目录",
    nameColumn: "名称",
    pathColumn: "路径",
    updatedColumn: "更新时间",
    actionsColumn: "操作",
    openButton: "打开",
    copyButton: "复制",
    deleteButton: "删除",
    refreshHelp: "重新读取当前分类和 skills 列表",
    openLocalHelp: "在 Finder 中打开当前工具的本地 skills 目录",
    openICloudHelp: "在 Finder 中打开当前工具对应的 iCloud 共享目录",
    moreHelp: "展开较少使用的管理操作",
    linkHelp: "把当前工具的 skills 目录接到 iCloud",
    unlinkHelp: "取消当前工具到 iCloud 的连接，但不删除 iCloud 数据",
    restoreHelp: "把最近一次备份恢复回本地目录",
    setupHelp: "创建默认的 iCloud 共享目录结构",
    restoreMachineHelp: "在新电脑上按共享目录自动恢复本机路径",
    openButtonHelp: "在 Finder 中定位这个 skill",
    copyButtonHelp: "把这个 skill 复制到另一个工具分类",
    deleteButtonHelp: "删除这个 skill",
    emptyState: "这个分类下还没有 skill。",
    toolDescriptions: {
      global: "所有工具共享的 skills（~/.agent/skills）",
      codex: "只给 Codex 用的 skills",
      claude: "只给 Claude Code 用的 skills",
      antigravity: "只给 Antigravity 用的 skills",
      cursor: "只给 Cursor 用的用户级 skills（~/.cursor/skills 等）",
      opencode: "只给 OpenCode 用的 skills（~/.config/opencode/skills）",
      openclaw: "只给 OpenClaw 用的 skills（~/.openclaw/skills）",
      hermes: "Hermes Agent 主目录（~/.hermes/skills）",
    },
    tool: {
      global: "全局",
      codex: "Codex",
      claude: "Claude Code",
      antigravity: "Antigravity",
      cursor: "Cursor",
      opencode: "OpenCode",
      openclaw: "OpenClaw",
      hermes: "Hermes",
    },
    status: {
      symlinked: "已接入 iCloud",
      directory: "本地目录",
      missing: "未发现目录",
      unknown: "未知状态",
    },
    kind: {
      directory: "目录",
      file: "文件",
    },
    countText: (count) => `${count} 个 skills`,
    confirmDelete: (name, tool) => `确定要从 ${toolLabel(tool)} 删除“${name}”吗？`,
    copyPromptTool:
      "复制到哪个分类？请输入：global / codex / claude / antigravity / cursor / opencode / openclaw / hermes",
    copyPromptName: (name) => `复制后的名称，留空表示保持“${name}”`,
    loadError: (error) => `加载失败：${error}`,
    syncHintIcloud:
      "已接入 iCloud：编辑、新增或删除会立刻写进当前 iCloud 盘里的目录，由系统负责与云端和其他设备同步。本窗口会尝试在检测到变更时自动刷新列表。",
    syncHintLocal:
      "当前是本地真实目录，尚未用软链接到 iCloud。可在「更多 → 接入」后，让本机路径指向 iCloud 中同一份数据，再保存即会进入 iCloud。",
    syncHintMissing: "未找到有效的 skills 根目录。可先执行「初始化 iCloud」或检查工具是否已安装。",
    specHasSkillMd: "含 SKILL.md",
    specMissingSkillMd: "无 SKILL.md",
    specHasSkillMdHelp: "子目录下存在 SKILL.md（常见 Agent / skm 类工具约定）",
    specMissingSkillMdHelp: "子目录中未找到 SKILL.md。可参考 agentskills.io 或 reorx/skm 的约定。",
  },
  en: {
    title: "Esay Cloud Skills",
    setupButton: "Initialize iCloud",
    restoreMachineButton: "Restore This Mac",
    refreshButton: "Refresh",
    moreButton: "More",
    linkButton: "Link",
    unlinkButton: "Unlink",
    restoreButton: "Restore",
    openLocalButton: "Open Local Folder",
    openICloudButton: "Open iCloud Folder",
    nameColumn: "Name",
    pathColumn: "Path",
    updatedColumn: "Updated",
    actionsColumn: "Actions",
    openButton: "Open",
    copyButton: "Copy",
    deleteButton: "Delete",
    refreshHelp: "Reload the current category and skill list",
    openLocalHelp: "Open the local skills folder for the current tool in Finder",
    openICloudHelp: "Open the shared iCloud folder for the current tool in Finder",
    moreHelp: "Show less common management actions",
    linkHelp: "Connect the current tool's skills folder to iCloud",
    unlinkHelp: "Disconnect the current tool from iCloud without deleting shared data",
    restoreHelp: "Restore the latest backup to the local folder",
    setupHelp: "Create the default iCloud shared folder layout",
    restoreMachineHelp: "Restore local paths on a new Mac from the shared layout",
    openButtonHelp: "Reveal this skill in Finder",
    copyButtonHelp: "Copy this skill to another tool category",
    deleteButtonHelp: "Delete this skill",
    emptyState: "There are no skills in this category yet.",
    toolDescriptions: {
      global: "Shared skills for every tool (~/.agent/skills)",
      codex: "Skills used by Codex",
      claude: "Skills used by Claude Code",
      antigravity: "Skills used by Antigravity",
      cursor: "User-level Cursor skills (~/.cursor/skills, ~/.agents/skills)",
      opencode: "OpenCode user-level skills (~/.config/opencode/skills)",
      openclaw: "OpenClaw managed skills (~/.openclaw/skills)",
      hermes: "Hermes Agent home skills (~/.hermes/skills)",
    },
    tool: {
      global: "Global",
      codex: "Codex",
      claude: "Claude Code",
      antigravity: "Antigravity",
      cursor: "Cursor",
      opencode: "OpenCode",
      openclaw: "OpenClaw",
      hermes: "Hermes",
    },
    status: {
      symlinked: "Linked to iCloud",
      directory: "Local folder",
      missing: "Folder not found",
      unknown: "Unknown",
    },
    kind: {
      directory: "Folder",
      file: "File",
    },
    countText: (count) => `${count} skills`,
    confirmDelete: (name, tool) => `Delete "${name}" from ${toolLabel(tool)}?`,
    copyPromptTool:
      "Copy to which category? Enter: global / codex / claude / antigravity / cursor / opencode / openclaw / hermes",
    copyPromptName: (name) => `Name for the copy. Leave blank to keep "${name}"`,
    loadError: (error) => `Load failed: ${error}`,
    syncHintIcloud:
      "Linked to iCloud: edits, new files, and deletes are written into your iCloud Drive folder; macOS syncs to the cloud and your other devices. This window refreshes the list when it detects changes.",
    syncHintLocal:
      "This is a normal local folder, not yet symlinked to iCloud. Use More → Link so the app path points at the shared iCloud copy; then saves go into iCloud.",
    syncHintMissing: "No valid skills root found. Run Initialize iCloud in More, or check that the tool is installed.",
    specHasSkillMd: "Has SKILL.md",
    specMissingSkillMd: "No SKILL.md",
    specHasSkillMdHelp: "Conventional agent skill (SKILL.md present, same as tools like reorx/skm expect)",
    specMissingSkillMdHelp: "No SKILL.md in this folder. Use agentskills.io / SKM-style layout to be discoverable.",
  },
};

const state = {
  language: localStorage.getItem("esay-cloud-skills-language") || "zh",
  activeTool: "global",
  targets: [],
  skills: [],
};

function t(key) {
  return translations[state.language][key] ?? key;
}

function toolLabel(tool) {
  return translations[state.language].tool[tool] ?? tool;
}

function kindLabel(kind) {
  return translations[state.language].kind[kind] ?? kind;
}

function formatModifiedAt(iso) {
  if (iso == null || iso === "") {
    return "—";
  }
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) {
    return String(iso);
  }
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const h = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  return `${y}-${m}-${day} ${h}:${min}`;
}

function currentTarget() {
  return state.targets.find((item) => item.tool === state.activeTool);
}

function currentSkillsGroup() {
  return state.skills.find((item) => item.tool === state.activeTool);
}

function applyTranslations() {
  doc.lang = state.language === "zh" ? "zh-CN" : "en";
  localStorage.setItem("esay-cloud-skills-language", state.language);
  for (const node of document.querySelectorAll("[data-i18n]")) {
    node.textContent = t(node.dataset.i18n);
  }
  for (const node of document.querySelectorAll("[data-i18n-title]")) {
    node.title = t(node.dataset.i18nTitle);
  }
  elements.zhButton.classList.toggle("active", state.language === "zh");
  elements.enButton.classList.toggle("active", state.language === "en");
}

function renderTabs() {
  elements.tabs.innerHTML = "";
  for (const tool of TOOL_ORDER) {
    const button = document.createElement("button");
    button.className = `tab-button${tool === state.activeTool ? " active" : ""}`;
    button.textContent = toolLabel(tool);
    button.addEventListener("click", () => {
      state.activeTool = tool;
      render();
    });
    elements.tabs.append(button);
  }
}

function renderHeader() {
  const target = currentTarget();
  const group = currentSkillsGroup();
  const count = group?.items?.length ?? 0;
  elements.title.textContent = toolLabel(state.activeTool);
  elements.description.textContent = translations[state.language].toolDescriptions[state.activeTool] ?? "";
  elements.statusText.textContent = translations[state.language].status[target?.status ?? "unknown"];
  elements.countText.textContent = t("countText")(count);
  elements.pathBadge.textContent = group?.rootPath ?? target?.iCloudPath ?? target?.localPath ?? "—";

  if (elements.syncHint) {
    const source = group?.source;
    const hintKey =
      source === "icloud" ? "syncHintIcloud" : source === "local" ? "syncHintLocal" : "syncHintMissing";
    const text = t(hintKey);
    elements.syncHint.textContent = text;
    elements.syncHint.hidden = !text;
  }
}

async function revealPath(path) {
  return invoke("reveal_in_finder", { path });
}

async function syncFileWatchPath() {
  if (!invoke) {
    return;
  }
  const group = currentSkillsGroup();
  const p = group?.rootPath;
  try {
    await invoke("set_skills_watch", { path: p ?? null });
  } catch {
    /* e.g. browser or old shell without the command */
  }
}

async function loadData() {
  const [scan, skills] = await Promise.all([
    invoke("scan"),
    invoke("list_skills", { target: "all" }),
  ]);
  state.targets = scan.results;
  state.skills = skills.results;
  await syncFileWatchPath();
  render();
}

async function runToolAction(action) {
  await invoke("run_action", { action, target: state.activeTool });
  await loadData();
}

async function onDelete(skill) {
  if (!window.confirm(t("confirmDelete")(skill.name, state.activeTool))) {
    return;
  }
  await invoke("delete_skill", {
    tool: state.activeTool,
    skillName: skill.name,
  });
  await loadData();
}

async function onCopy(skill) {
  const tool = window.prompt(t("copyPromptTool"), "codex");
  if (!tool) {
    return;
  }
  const targetTool = tool.trim().toLowerCase();
  if (!TOOL_ORDER.includes(targetTool)) {
    return;
  }
  const targetName = window.prompt(t("copyPromptName")(skill.name), skill.name)?.trim() || skill.name;
  await invoke("copy_skill", {
    sourceTool: state.activeTool,
    skillName: skill.name,
    targetTool,
    targetName,
  });
  state.activeTool = targetTool;
  await loadData();
}

function renderTable() {
  const group = currentSkillsGroup();
  const items = group?.items ?? [];
  elements.tableBody.innerHTML = "";
  elements.emptyState.style.display = items.length === 0 ? "block" : "none";

  for (const skill of items) {
    const fragment = elements.template.content.cloneNode(true);
    const rawModified = skill.modifiedAt;
    const updatedEl = fragment.querySelector(".skill-updated");
    fragment.querySelector(".skill-name").textContent = skill.name;
    fragment.querySelector(".skill-kind").textContent = kindLabel(skill.kind);
    const specEl = fragment.querySelector(".skill-spec");
    if (state.activeTool === "hermes") {
      specEl.hidden = true;
      specEl.textContent = "";
    } else if (skill.kind === "directory") {
      specEl.hidden = false;
      if (skill.hasSkillMd) {
        specEl.textContent = t("specHasSkillMd");
        specEl.classList.remove("skill-spec--warn");
        specEl.title = t("specHasSkillMdHelp");
      } else {
        specEl.textContent = t("specMissingSkillMd");
        specEl.classList.add("skill-spec--warn");
        specEl.title = t("specMissingSkillMdHelp");
      }
    } else {
      specEl.hidden = true;
      specEl.textContent = "";
    }
    fragment.querySelector(".skill-path").textContent = skill.path;
    updatedEl.textContent = formatModifiedAt(rawModified);
    if (rawModified) {
      updatedEl.title = typeof rawModified === "string" ? rawModified : String(rawModified);
    } else {
      updatedEl.removeAttribute("title");
    }
    const pathCell = fragment.querySelector(".col-path .skill-path");
    pathCell.title = skill.path ?? "";
    fragment.querySelector(".skill-open").textContent = t("openButton");
    fragment.querySelector(".skill-copy").textContent = t("copyButton");
    fragment.querySelector(".skill-delete").textContent = t("deleteButton");
    fragment.querySelector(".skill-open").title = t("openButtonHelp");
    fragment.querySelector(".skill-copy").title = t("copyButtonHelp");
    fragment.querySelector(".skill-delete").title = t("deleteButtonHelp");
    fragment.querySelector(".skill-open").addEventListener("click", async () => {
      await revealPath(skill.path);
    });
    fragment.querySelector(".skill-copy").addEventListener("click", async () => {
      await onCopy(skill);
    });
    fragment.querySelector(".skill-delete").addEventListener("click", async () => {
      await onDelete(skill);
    });
    elements.tableBody.append(fragment);
  }
}

function render() {
  applyTranslations();
  renderTabs();
  renderHeader();
  renderTable();
}

function closeMoreMenu() {
  elements.morePanel.classList.add("hidden");
}

function bindEvents() {
  elements.zhButton.addEventListener("click", () => {
    state.language = "zh";
    render();
  });

  elements.enButton.addEventListener("click", () => {
    state.language = "en";
    render();
  });

  elements.setupButton.addEventListener("click", async () => {
    closeMoreMenu();
    await invoke("run_action", { action: "setup", target: "all" });
    await loadData();
  });

  elements.restoreMachineButton.addEventListener("click", async () => {
    closeMoreMenu();
    await invoke("run_action", { action: "restore-machine", target: "all" });
    await loadData();
  });

  elements.refreshButton.addEventListener("click", async () => {
    await loadData();
  });

  elements.moreButton.addEventListener("click", (event) => {
    event.stopPropagation();
    elements.morePanel.classList.toggle("hidden");
  });

  document.addEventListener("click", (event) => {
    if (!elements.morePanel.contains(event.target)) {
      closeMoreMenu();
    }
  });

  elements.linkButton.addEventListener("click", async () => {
    closeMoreMenu();
    await runToolAction("link");
  });

  elements.unlinkButton.addEventListener("click", async () => {
    closeMoreMenu();
    await runToolAction("unlink");
  });

  elements.restoreButton.addEventListener("click", async () => {
    closeMoreMenu();
    await runToolAction("restore");
  });

  elements.openLocalButton.addEventListener("click", async () => {
    const target = currentTarget();
    const path = target?.localPath;
    if (path) {
      await revealPath(path);
    }
  });

  elements.openICloudButton.addEventListener("click", async () => {
    const target = currentTarget();
    const path = target?.iCloudPath;
    if (path) {
      await revealPath(path);
    }
  });
}

async function initialize() {
  bindEvents();
  applyTranslations();
  const tauri = window.__TAURI__;
  if (tauri?.event?.listen) {
    let debounceRefresh;
    await tauri.event.listen("skills-refresh", () => {
      clearTimeout(debounceRefresh);
      debounceRefresh = setTimeout(() => {
        void loadData();
      }, 450);
    });
  }
  try {
    await loadData();
  } catch (error) {
    alert(t("loadError")(String(error)));
  }
}

initialize();
