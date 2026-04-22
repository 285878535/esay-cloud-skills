const invoke = window.__TAURI__?.core?.invoke;
const doc = document.documentElement;

const elements = {
  tabs: document.querySelector("#tool-tabs"),
  pathBadge: document.querySelector("#path-badge"),
  title: document.querySelector("#current-tool-title"),
  description: document.querySelector("#current-tool-description"),
  statusText: document.querySelector("#status-text"),
  countText: document.querySelector("#count-text"),
  tableBody: document.querySelector("#skills-table-body"),
  emptyState: document.querySelector("#empty-state"),
  template: document.querySelector("#skill-row-template"),
  setupButton: document.querySelector("#setup-button"),
  refreshButton: document.querySelector("#refresh-button"),
  linkButton: document.querySelector("#link-button"),
  unlinkButton: document.querySelector("#unlink-button"),
  restoreButton: document.querySelector("#restore-button"),
  openRootButton: document.querySelector("#open-root-button"),
  zhButton: document.querySelector("#lang-zh"),
  enButton: document.querySelector("#lang-en"),
};

const TOOL_ORDER = ["global", "codex", "claude", "antigravity"];

const translations = {
  zh: {
    title: "Skills Manager",
    setupButton: "初始化 iCloud",
    refreshButton: "刷新",
    linkButton: "接入",
    unlinkButton: "取消接入",
    restoreButton: "恢复备份",
    openRootButton: "打开目录",
    nameColumn: "名称",
    pathColumn: "路径",
    updatedColumn: "更新时间",
    actionsColumn: "操作",
    openButton: "打开",
    copyButton: "复制",
    deleteButton: "删除",
    emptyState: "这个分类下还没有 skill。",
    toolDescriptions: {
      global: "所有工具共享的 skills",
      codex: "只给 Codex 用的 skills",
      claude: "只给 Claude Code 用的 skills",
      antigravity: "只给 Antigravity 用的 skills",
    },
    tool: {
      global: "全局",
      codex: "Codex",
      claude: "Claude Code",
      antigravity: "Antigravity",
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
    copyPromptTool: "复制到哪个分类？请输入：global / codex / claude / antigravity",
    copyPromptName: (name) => `复制后的名称，留空表示保持“${name}”`,
    loadError: (error) => `加载失败：${error}`,
  },
  en: {
    title: "Skills Manager",
    setupButton: "Initialize iCloud",
    refreshButton: "Refresh",
    linkButton: "Link",
    unlinkButton: "Unlink",
    restoreButton: "Restore",
    openRootButton: "Open Folder",
    nameColumn: "Name",
    pathColumn: "Path",
    updatedColumn: "Updated",
    actionsColumn: "Actions",
    openButton: "Open",
    copyButton: "Copy",
    deleteButton: "Delete",
    emptyState: "There are no skills in this category yet.",
    toolDescriptions: {
      global: "Shared skills for every tool",
      codex: "Skills used by Codex",
      claude: "Skills used by Claude Code",
      antigravity: "Skills used by Antigravity",
    },
    tool: {
      global: "Global",
      codex: "Codex",
      claude: "Claude Code",
      antigravity: "Antigravity",
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
    copyPromptTool: "Copy to which category? Enter: global / codex / claude / antigravity",
    copyPromptName: (name) => `Name for the copy. Leave blank to keep "${name}"`,
    loadError: (error) => `Load failed: ${error}`,
  },
};

const state = {
  language: localStorage.getItem("skills-manager-language") || "zh",
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

function currentTarget() {
  return state.targets.find((item) => item.tool === state.activeTool);
}

function currentSkillsGroup() {
  return state.skills.find((item) => item.tool === state.activeTool);
}

function applyTranslations() {
  doc.lang = state.language === "zh" ? "zh-CN" : "en";
  localStorage.setItem("skills-manager-language", state.language);
  for (const node of document.querySelectorAll("[data-i18n]")) {
    node.textContent = t(node.dataset.i18n);
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
}

async function revealPath(path) {
  return invoke("reveal_in_finder", { path });
}

async function loadData() {
  const [scan, skills] = await Promise.all([
    invoke("scan"),
    invoke("list_skills", { target: "all" }),
  ]);
  state.targets = scan.results;
  state.skills = skills.results;
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
    fragment.querySelector(".skill-name").textContent = skill.name;
    fragment.querySelector(".skill-kind").textContent = kindLabel(skill.kind);
    fragment.querySelector(".skill-path").textContent = skill.path;
    fragment.querySelector(".skill-updated").textContent = skill.modifiedAt ?? "—";
    fragment.querySelector(".skill-open").textContent = t("openButton");
    fragment.querySelector(".skill-copy").textContent = t("copyButton");
    fragment.querySelector(".skill-delete").textContent = t("deleteButton");
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
    await invoke("run_action", { action: "setup", target: "all" });
    await loadData();
  });

  elements.refreshButton.addEventListener("click", async () => {
    await loadData();
  });

  elements.linkButton.addEventListener("click", async () => {
    await runToolAction("link");
  });

  elements.unlinkButton.addEventListener("click", async () => {
    await runToolAction("unlink");
  });

  elements.restoreButton.addEventListener("click", async () => {
    await runToolAction("restore");
  });

  elements.openRootButton.addEventListener("click", async () => {
    const group = currentSkillsGroup();
    const target = currentTarget();
    const path = group?.rootPath ?? target?.iCloudPath ?? target?.localPath;
    if (path) {
      await revealPath(path);
    }
  });
}

async function initialize() {
  bindEvents();
  applyTranslations();
  try {
    await loadData();
  } catch (error) {
    alert(t("loadError")(String(error)));
  }
}

initialize();
