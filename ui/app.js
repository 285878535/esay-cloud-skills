const invoke = window.__TAURI__?.core?.invoke;
const doc = document.documentElement;

const elements = {
  tabs: document.querySelector("#tool-tabs"),
  root: document.querySelector("#icloud-root"),
  doctor: document.querySelector("#doctor-output"),
  log: document.querySelector("#event-log"),
  title: document.querySelector("#current-tool-title"),
  description: document.querySelector("#current-tool-description"),
  statusPill: document.querySelector("#tool-status-pill"),
  rootPath: document.querySelector("#tool-root-path"),
  skillCount: document.querySelector("#tool-skill-count"),
  skillsList: document.querySelector("#skills-list"),
  template: document.querySelector("#skill-row-template"),
  setupButton: document.querySelector("#setup-button"),
  refreshButton: document.querySelector("#refresh-button"),
  doctorButton: document.querySelector("#doctor-button"),
  linkButton: document.querySelector("#link-tool-button"),
  unlinkButton: document.querySelector("#unlink-tool-button"),
  restoreButton: document.querySelector("#restore-tool-button"),
  openRootButton: document.querySelector("#open-root-button"),
  zhButton: document.querySelector("#lang-zh"),
  enButton: document.querySelector("#lang-en"),
};

const TOOL_ORDER = ["global", "codex", "claude", "antigravity"];

const translations = {
  zh: {
    brandEyebrow: "Skills Hub",
    brandTitle: "Skills Manager",
    brandSubtitle: "按工具分类查看和管理 skills，第一栏是全局共享。",
    setupButton: "初始化 iCloud",
    refreshButton: "刷新列表",
    doctorButton: "检查问题",
    rootLabel: "当前 iCloud 根目录",
    currentToolEyebrow: "当前分类",
    linkButton: "接入 iCloud",
    unlinkButton: "取消接入",
    restoreButton: "恢复备份",
    openRootButton: "打开当前分类目录",
    statusLabel: "状态",
    activePathLabel: "当前目录",
    skillCountLabel: "Skills 数量",
    skillsListTitle: "Skills 列表",
    skillsListNote: "点击任意 skill 的按钮可打开目录、复制到其它分类或删除。",
    doctorEyebrow: "问题检查",
    doctorTitle: "问题面板",
    doctorEmpty: "这里会显示检查结果。",
    logEyebrow: "操作记录",
    eventLogTitle: "事件日志",
    eventLogEmpty: "所有操作会记录在这里。",
    openButton: "打开",
    copyButton: "复制",
    deleteButton: "删除",
    noRoot: "尚未找到可用目录",
    noSkills: "这个分类下还没有 skill。",
    noValue: "—",
    healthy: "状态正常：没有发现问题。",
    toolDescriptions: {
      global: "这里放所有工具都能共用的 skills。",
      codex: "这里放只给 Codex 用的 skills。",
      claude: "这里放只给 Claude Code 用的 skills。",
      antigravity: "这里放只给 Antigravity 用的 skills。",
    },
    tool: {
      global: "全局",
      codex: "Codex",
      claude: "Claude Code",
      antigravity: "Antigravity",
      all: "全部",
    },
    status: {
      symlinked: "已接入",
      directory: "本地目录",
      missing: "未发现",
      unknown: "未知",
    },
    source: {
      icloud: "iCloud",
      local: "本地",
      missing: "未找到",
    },
    kind: {
      directory: "目录",
      file: "文件",
    },
    severity: {
      error: "错误",
      warn: "警告",
      info: "提示",
    },
    logLoaded: "已刷新分类和 skills 列表。",
    logError: (message) => `操作失败：${message}`,
    confirmDelete: (name, tool) => `确定要从 ${toolLabel(tool)} 删除 skill “${name}” 吗？`,
    copyPromptTool: (name) => `把 “${name}” 复制到哪个分类？请输入：global / codex / claude / antigravity`,
    copyPromptName: (name) => `复制后的名称是什么？直接回车表示保持 “${name}”`,
    copied: (name) => `已复制 ${name}`,
  },
  en: {
    brandEyebrow: "Skills Hub",
    brandTitle: "Skills Manager",
    brandSubtitle: "Browse and manage skills by tool. The first tab is the shared global set.",
    setupButton: "Initialize iCloud",
    refreshButton: "Refresh",
    doctorButton: "Run Doctor",
    rootLabel: "Current iCloud Root",
    currentToolEyebrow: "Current Category",
    linkButton: "Link to iCloud",
    unlinkButton: "Unlink",
    restoreButton: "Restore Backup",
    openRootButton: "Open Current Folder",
    statusLabel: "Status",
    activePathLabel: "Current Path",
    skillCountLabel: "Skill Count",
    skillsListTitle: "Skills",
    skillsListNote: "Each skill can be opened in Finder, copied to another category, or deleted.",
    doctorEyebrow: "Doctor",
    doctorTitle: "Issues",
    doctorEmpty: "Doctor results will appear here.",
    logEyebrow: "Activity",
    eventLogTitle: "Event Log",
    eventLogEmpty: "All actions are recorded here.",
    openButton: "Open",
    copyButton: "Copy",
    deleteButton: "Delete",
    noRoot: "No usable folder found yet",
    noSkills: "There are no skills in this category yet.",
    noValue: "—",
    healthy: "Healthy: no issues found.",
    toolDescriptions: {
      global: "Shared skills available to every tool.",
      codex: "Skills used only by Codex.",
      claude: "Skills used only by Claude Code.",
      antigravity: "Skills used only by Antigravity.",
    },
    tool: {
      global: "Global",
      codex: "Codex",
      claude: "Claude Code",
      antigravity: "Antigravity",
      all: "All",
    },
    status: {
      symlinked: "Linked",
      directory: "Local Folder",
      missing: "Missing",
      unknown: "Unknown",
    },
    source: {
      icloud: "iCloud",
      local: "Local",
      missing: "Missing",
    },
    kind: {
      directory: "Folder",
      file: "File",
    },
    severity: {
      error: "Error",
      warn: "Warn",
      info: "Info",
    },
    logLoaded: "Refreshed categories and skill lists.",
    logError: (message) => `Action failed: ${message}`,
    confirmDelete: (name, tool) => `Delete skill "${name}" from ${toolLabel(tool)}?`,
    copyPromptTool: (name) => `Copy "${name}" to which category? Enter: global / codex / claude / antigravity`,
    copyPromptName: (name) => `New name for the copy? Leave blank to keep "${name}"`,
    copied: (name) => `Copied ${name}`,
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

function statusLabel(status) {
  return translations[state.language].status[status] ?? translations[state.language].status.unknown;
}

function sourceLabel(source) {
  return translations[state.language].source[source] ?? source;
}

function severityLabel(level) {
  return translations[state.language].severity[level] ?? level;
}

function kindLabel(kind) {
  return translations[state.language].kind[kind] ?? kind;
}

function pushLog(message) {
  const timestamp = new Date().toLocaleString();
  elements.log.classList.remove("empty");
  elements.log.textContent = `[${timestamp}] ${message}\n${elements.log.textContent}`;
}

function applyTranslations() {
  doc.lang = state.language === "zh" ? "zh-CN" : "en";
  localStorage.setItem("skills-manager-language", state.language);
  for (const node of document.querySelectorAll("[data-i18n]")) {
    node.textContent = t(node.dataset.i18n);
  }
  for (const node of document.querySelectorAll("[data-i18n-title]")) {
    node.title = t(node.dataset.i18nTitle);
  }
  elements.zhButton.classList.toggle("active", state.language === "zh");
  elements.enButton.classList.toggle("active", state.language === "en");
}

function currentTarget() {
  return state.targets.find((item) => item.tool === state.activeTool);
}

function currentSkillsGroup() {
  return state.skills.find((item) => item.tool === state.activeTool);
}

function pillClass(status) {
  if (status === "symlinked") {
    return "ok";
  }
  if (status === "directory") {
    return "warn";
  }
  return "muted";
}

function renderTabs() {
  elements.tabs.innerHTML = "";

  for (const tool of TOOL_ORDER) {
    const target = state.targets.find((item) => item.tool === tool);
    const button = document.createElement("button");
    button.className = "tab-button";
    if (tool === state.activeTool) {
      button.classList.add("active");
    }
    button.innerHTML = `
      <span class="tab-title">${toolLabel(tool)}</span>
      <span class="tab-status ${pillClass(target?.status ?? "missing")}">${statusLabel(target?.status ?? "missing")}</span>
    `;
    button.addEventListener("click", () => {
      state.activeTool = tool;
      render();
    });
    elements.tabs.append(button);
  }
}

function renderDoctor(issues) {
  if (!issues.length) {
    elements.doctor.classList.add("empty");
    elements.doctor.textContent = t("healthy");
    return;
  }

  elements.doctor.classList.remove("empty");
  elements.doctor.textContent = issues
    .map((item) => `[${severityLabel(item.severity)}] [${toolLabel(item.tool)}] ${item.message}`)
    .join("\n");
}

function renderHeader() {
  const target = currentTarget();
  const skillsGroup = currentSkillsGroup();
  elements.title.textContent = toolLabel(state.activeTool);
  elements.description.textContent = translations[state.language].toolDescriptions[state.activeTool] ?? "";
  elements.statusPill.textContent = statusLabel(target?.status ?? "missing");
  elements.statusPill.className = `pill ${pillClass(target?.status ?? "missing")}`;
  elements.root.textContent = target?.iCloudPath ?? t("noValue");
  elements.rootPath.textContent = skillsGroup?.rootPath ?? target?.localPath ?? t("noRoot");
  elements.skillCount.textContent = String(skillsGroup?.items?.length ?? 0);
}

function revealPath(path) {
  return invoke("reveal_in_finder", { path });
}

async function onDeleteSkill(skill) {
  if (!window.confirm(t("confirmDelete")(skill.name, state.activeTool))) {
    return;
  }
  const response = await invoke("delete_skill", {
    tool: state.activeTool,
    skillName: skill.name,
  });
  pushLog(response.message);
  await loadData();
}

async function onCopySkill(skill) {
  const tool = window.prompt(t("copyPromptTool")(skill.name), "codex");
  if (!tool) {
    return;
  }
  const targetTool = tool.trim().toLowerCase();
  if (!TOOL_ORDER.includes(targetTool)) {
    pushLog(t("logError")(`Unknown target tool: ${tool}`));
    return;
  }
  const targetName = window.prompt(t("copyPromptName")(skill.name), skill.name)?.trim() || skill.name;
  const response = await invoke("copy_skill", {
    sourceTool: state.activeTool,
    skillName: skill.name,
    targetTool,
    targetName,
  });
  pushLog(response.message);
  state.activeTool = targetTool;
  await loadData();
}

function renderSkills() {
  const skillsGroup = currentSkillsGroup();
  elements.skillsList.innerHTML = "";

  if (!skillsGroup || skillsGroup.items.length === 0) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = t("noSkills");
    elements.skillsList.append(empty);
    return;
  }

  for (const skill of skillsGroup.items) {
    const fragment = elements.template.content.cloneNode(true);
    fragment.querySelector(".skill-name").textContent = skill.name;
    fragment.querySelector(".skill-kind").textContent = kindLabel(skill.kind);
    fragment.querySelector(".skill-path").textContent = skill.path;
    fragment.querySelector(".skill-open").textContent = t("openButton");
    fragment.querySelector(".skill-copy").textContent = t("copyButton");
    fragment.querySelector(".skill-delete").textContent = t("deleteButton");
    fragment.querySelector(".skill-open").title = t("openButton");
    fragment.querySelector(".skill-copy").title = t("copyButton");
    fragment.querySelector(".skill-delete").title = t("deleteButton");
    fragment.querySelector(".skill-open").addEventListener("click", async () => {
      const response = await revealPath(skill.path);
      pushLog(response.message);
    });
    fragment.querySelector(".skill-copy").addEventListener("click", async () => {
      await onCopySkill(skill);
    });
    fragment.querySelector(".skill-delete").addEventListener("click", async () => {
      await onDeleteSkill(skill);
    });
    elements.skillsList.append(fragment);
  }
}

function render() {
  applyTranslations();
  renderTabs();
  renderHeader();
  renderSkills();
}

async function loadData() {
  if (!invoke) {
    throw new Error("Tauri API is not available in the frontend.");
  }

  const [scan, skills] = await Promise.all([
    invoke("scan"),
    invoke("list_skills", { target: "all" }),
  ]);

  state.targets = scan.results;
  state.skills = skills.results;

  if (!TOOL_ORDER.includes(state.activeTool)) {
    state.activeTool = "global";
  }

  render();
}

async function runToolAction(action) {
  const response = await invoke("run_action", {
    action,
    target: state.activeTool,
  });
  pushLog(response.message);
  await loadData();
}

function bindEvents() {
  elements.zhButton.addEventListener("click", async () => {
    state.language = "zh";
    render();
  });

  elements.enButton.addEventListener("click", async () => {
    state.language = "en";
    render();
  });

  elements.setupButton.addEventListener("click", async () => {
    const response = await invoke("run_action", { action: "setup", target: "all" });
    pushLog(response.message);
    await loadData();
  });

  elements.refreshButton.addEventListener("click", async () => {
    await loadData();
    pushLog(t("logLoaded"));
  });

  elements.doctorButton.addEventListener("click", async () => {
    const response = await invoke("run_action", { action: "doctor", target: "all" });
    renderDoctor(response.issues ?? []);
    pushLog(response.message || "doctor");
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
    if (!path) {
      pushLog(t("logError")(t("noRoot")));
      return;
    }
    const response = await revealPath(path);
    pushLog(response.message);
  });
}

async function initialize() {
  bindEvents();
  applyTranslations();
  try {
    await loadData();
    pushLog(t("logLoaded"));
  } catch (error) {
    pushLog(t("logError")(String(error)));
  }
}

initialize();
