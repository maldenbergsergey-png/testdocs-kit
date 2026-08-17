#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import readline from "node:readline/promises";
import { spawnSync } from "node:child_process";
import {
  getCodexConfigFile,
  getConfigDir,
  getConfigFile,
  getInstallHome,
  getOpenCodeConfigFile,
  browserAuthFile,
  launcherFile,
  repoRoot
} from "./paths.mjs";

const SUPPORTED_CLIENTS = new Set(["codex", "claude", "opencode", "generic"]);
const MANAGED_BEGIN = "# BEGIN testdocs-kit (managed by npm run setup)";
const MANAGED_END = "# END testdocs-kit";
const stamp = new Date().toISOString().replace(/[:.]/g, "-");

function parseArgs(argv) {
  const result = {
    clients: null,
    force: false,
    skipDependencies: false,
    noCli: false,
    skipBrowserAuth: false,
    answers: null,
    openCodeFormat: null,
    caFile: null
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--clients") result.clients = argv[++index]?.split(",");
    else if (arg === "--answers") result.answers = argv[++index];
    else if (arg === "--opencode-format") result.openCodeFormat = argv[++index];
    else if (arg === "--ca-file") result.caFile = argv[++index];
    else if (arg === "--force") result.force = true;
    else if (arg === "--skip-dependencies") result.skipDependencies = true;
    else if (arg === "--no-cli") result.noCli = true;
    else if (arg === "--skip-browser-auth") result.skipBrowserAuth = true;
    else if (arg === "--help" || arg === "-h") result.help = true;
    else throw new Error(`Неизвестный аргумент: ${arg}`);
  }
  return result;
}

function showHelp() {
  console.log(`Использование: npm run setup -- [параметры]

Параметры:
  --clients codex,claude,opencode,generic  Настроить указанные клиенты
  --answers /path/to/answers.json          Взять ответы из JSON без вопросов
  --opencode-format stable|v2              Явно выбрать формат OpenCode
  --ca-file /path/to/ca-bundle.pem         Дополнительные доверенные CA в формате PEM
  --skip-dependencies                     Не выполнять npm ci; Confluence всё равно пересобирается
  --no-cli                                Не вызывать CLI клиентов
  --skip-browser-auth                     Не открывать браузер для session-входа
  --force                                 Сделать резервную копию конфликтующих скиллов
  --help                                  Показать справку`);
}

function normalizeClients(values) {
  const clients = (values || []).map((value) => value.trim().toLowerCase()).filter(Boolean);
  for (const client of clients) {
    if (!SUPPORTED_CLIENTS.has(client)) throw new Error(`Неподдерживаемый клиент: ${client}`);
  }
  return [...new Set(clients)];
}

function normalizeOpenCodeFormat(value) {
  if (!value) return null;
  const format = value.trim().toLowerCase();
  if (!["stable", "v2"].includes(format)) {
    throw new Error(`Неподдерживаемый формат OpenCode: ${value}. Используйте stable или v2.`);
  }
  return format;
}

async function ask(question, fallback = "") {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const suffix = fallback ? ` [${fallback}]` : "";
  const answer = (await rl.question(`${question}${suffix}: `)).trim();
  rl.close();
  return answer || fallback;
}

async function confirm(question, fallback = true) {
  const hint = fallback ? "Y/n" : "y/N";
  const answer = (await ask(`${question} (${hint})`)).toLowerCase();
  if (!answer) return fallback;
  return ["y", "yes", "д", "да"].includes(answer);
}

async function askSecret(question, previous = "") {
  if (!process.stdin.isTTY || typeof process.stdin.setRawMode !== "function") {
    return ask(question, previous);
  }

  const keepHint = previous ? " (Enter — оставить текущее значение)" : "";
  process.stdout.write(`${question}${keepHint}: `);
  process.stdin.setRawMode(true);
  process.stdin.resume();
  process.stdin.setEncoding("utf8");

  return new Promise((resolve, reject) => {
    let value = "";
    const cleanup = () => {
      process.stdin.off("data", onData);
      process.stdin.setRawMode(false);
      process.stdin.pause();
    };
    const onData = (chunk) => {
      for (const char of chunk) {
        if (char === "\u0003") {
          cleanup();
          process.stdout.write("\n");
          reject(new Error("Установка отменена."));
          return;
        }
        if (char === "\r" || char === "\n") {
          cleanup();
          process.stdout.write("\n");
          resolve(value || previous);
          return;
        }
        if (char === "\u007f" || char === "\b") {
          if (value) {
            value = value.slice(0, -1);
            process.stdout.write("\b \b");
          }
          continue;
        }
        if (char >= " ") {
          value += char;
          process.stdout.write("*");
        }
      }
    };
    process.stdin.on("data", onData);
  });
}

function readExistingConfig() {
  const configFile = getConfigFile();
  if (!fs.existsSync(configFile)) return {};
  try {
    return JSON.parse(fs.readFileSync(configFile, "utf8"));
  } catch (error) {
    throw new Error(`Не удалось прочитать существующий ${configFile}: ${error.message}`);
  }
}

async function chooseClients(args) {
  if (args.clients) return normalizeClients(args.clients);
  const value = await ask(
    "Клиенты: 1 — Codex, 2 — Claude Code, 3 — OpenCode, 4 — все, 5 — generic",
    "4"
  );
  const mapping = {
    "1": ["codex"],
    "2": ["claude"],
    "3": ["opencode"],
    "4": ["codex", "claude", "opencode", "generic"],
    "5": ["generic"]
  };
  return mapping[value] || normalizeClients(value.split(","));
}

async function collectJira(previous = {}) {
  const enabled = await confirm("Подключить Jira", previous.enabled ?? true);
  if (!enabled) return { ...previous, enabled: false };

  const profile = await ask(
    "Jira: 1 — Cloud, 2 — Server/DC с PAT, 3 — логин и пароль, 4 — вход через браузер/SSO/2FA",
    previous.profile || "3"
  );
  const presets = {
    "1": { profile: "1", authMode: "basic", apiVersion: "3" },
    "2": { profile: "2", authMode: "bearer", apiVersion: "2" },
    "3": { profile: "3", authMode: "basic", apiVersion: "2" },
    "4": { profile: "4", authMode: "browser_session", apiVersion: "2" }
  };
  const preset = presets[profile] || presets["3"];
  const url = (await ask("Адрес Jira без завершающего слеша", previous.url || "https://jira.example.com")).replace(/\/+$/, "");
  if (preset.authMode === "browser_session") {
    return {
      enabled: true,
      ...preset,
      url,
      username: "",
      secret: "",
      insecureTls: false
    };
  }
  const username = preset.authMode === "bearer"
    ? ""
    : await ask("Логин или email Jira", previous.username || "");
  const secret = await askSecret(
    preset.authMode === "bearer" ? "PAT Jira" : profile === "1" ? "API-токен Jira" : "Пароль Jira",
    previous.secret || ""
  );
  if (!secret) throw new Error("Не заполнены учётные данные Jira.");

  return {
    enabled: true,
    ...preset,
    url,
    username,
    secret,
    insecureTls: false
  };
}

async function collectConfluence(previous = {}) {
  const enabled = await confirm("Подключить Confluence", previous.enabled ?? true);
  if (!enabled) return { ...previous, enabled: false };

  const profile = await ask(
    "Confluence: 1 — Cloud, 2 — Server/DC с PAT, 3 — логин и пароль, 4 — вход через браузер/SSO/2FA",
    previous.profile || "3"
  );
  const authMode = profile === "2" ? "bearer" : profile === "4" ? "browser_session" : "basic";
  const baseUrl = (await ask(
    "Адрес Confluence без завершающего слеша",
    previous.baseUrl || "https://confluence.example.com"
  )).replace(/\/+$/, "");
  if (authMode === "browser_session") {
    return {
      enabled: true,
      profile: "4",
      baseUrl,
      username: "",
      secret: "",
      authMode,
      insecureTls: false
    };
  }
  const username = authMode === "bearer"
    ? ""
    : await ask("Логин или email Confluence", previous.username || "");
  const secret = await askSecret(
    authMode === "bearer" ? "PAT Confluence" : profile === "1" ? "API-токен Confluence" : "Пароль Confluence",
    previous.secret || ""
  );
  if (!secret) throw new Error("Не заполнены учётные данные Confluence.");

  return {
    enabled: true,
    profile,
    baseUrl,
    username,
    secret,
    authMode,
    insecureTls: false
  };
}

function validateAnswers(config) {
  if (!config || typeof config !== "object") throw new Error("Файл ответов должен содержать JSON-объект.");
  for (const service of ["jira", "confluence"]) {
    const value = config[service];
    if (!value?.enabled) continue;
    const url = service === "jira" ? value.url : value.baseUrl;
    if (!url || !value.authMode || (value.authMode !== "browser_session" && !value.secret)) {
      throw new Error(`В файле ответов не полностью настроен ${service}.`);
    }
  }
  return config;
}

async function collectConfig(args, clients) {
  if (args.answers) {
    const answers = JSON.parse(fs.readFileSync(path.resolve(args.answers), "utf8"));
    return validateAnswers({ ...answers, clients });
  }

  const previous = readExistingConfig();
  console.log("\nСекреты вводятся скрыто и сохраняются вне репозитория.\n");
  return {
    version: 1,
    clients,
    enableWrites: false,
    jira: await collectJira(previous.jira),
    confluence: await collectConfluence(previous.confluence)
  };
}

function applyCaFile(config, value) {
  const supplied = value || config.caFile;
  if (!supplied) {
    delete config.caFile;
    return;
  }
  const caFile = path.resolve(supplied);
  if (!fs.existsSync(caFile) || !fs.statSync(caFile).isFile()) {
    throw new Error(`Не найден CA-файл: ${caFile}`);
  }
  const contents = fs.readFileSync(caFile, "utf8");
  if (!contents.includes("-----BEGIN CERTIFICATE-----")) {
    throw new Error(`CA-файл должен содержать сертификат в формате PEM: ${caFile}`);
  }
  config.caFile = caFile;
}

function savePrivateConfig(config) {
  const configFile = getConfigFile();
  fs.mkdirSync(path.dirname(configFile), { recursive: true, mode: 0o700 });
  fs.writeFileSync(configFile, `${JSON.stringify(config, null, 2)}\n`, { mode: 0o600 });
  try { fs.chmodSync(configFile, 0o600); } catch { /* Windows ACL управляется системой. */ }
  console.log(`Настройки сохранены: ${configFile}`);
}

function run(command, commandArgs, options = {}) {
  const result = spawnSync(command, commandArgs, { stdio: "inherit", ...options });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`Команда завершилась с кодом ${result.status}: ${command}`);
}

function installDependencies(skip, config) {
  const npm = process.platform === "win32" ? "npm.cmd" : "npm";
  const jiraDir = path.join(repoRoot, "mcp", "jira-mcp");
  const confluenceDir = path.join(repoRoot, "mcp", "confluence-mcp");

  if (skip) {
    console.log("Установка зависимостей пропущена.");
    if (config.jira?.enabled) {
      const jiraSdk = path.join(jiraDir, "node_modules", "@modelcontextprotocol", "sdk", "package.json");
      if (!fs.existsSync(jiraSdk)) {
        throw new Error("Зависимости Jira MCP не установлены. Повторите команду без --skip-dependencies.");
      }
    }
    if (config.confluence?.enabled) {
      const confluenceSdk = path.join(confluenceDir, "node_modules", "@modelcontextprotocol", "sdk", "package.json");
      const typescript = path.join(confluenceDir, "node_modules", ".bin", process.platform === "win32" ? "tsc.cmd" : "tsc");
      if (!fs.existsSync(confluenceSdk) || !fs.existsSync(typescript)) {
        throw new Error("Зависимости Confluence MCP не установлены. Повторите команду без --skip-dependencies.");
      }
      console.log("Пересобираю Confluence MCP из актуальных исходников...");
      run(npm, ["run", "build"], { cwd: confluenceDir });
    }
    return;
  }
  if (config.jira?.enabled) {
    console.log("\nУстанавливаю зависимости Jira MCP...");
    run(npm, ["ci"], { cwd: jiraDir });
  }
  if (config.confluence?.enabled) {
    console.log("\nУстанавливаю и собираю Confluence MCP...");
    run(npm, ["ci"], { cwd: confluenceDir });
    run(npm, ["run", "build"], { cwd: confluenceDir });
  }
}

function backupPath(target) {
  const backup = `${target}.backup-${stamp}`;
  fs.renameSync(target, backup);
  console.warn(`Создана резервная копия: ${backup}`);
}

function pathEntryExists(target) {
  try {
    fs.lstatSync(target);
    return true;
  } catch {
    return false;
  }
}

function installSkillSet(destinationRoot, force) {
  fs.mkdirSync(destinationRoot, { recursive: true });
  const sourceRoot = path.join(repoRoot, "skills");
  const skills = fs.readdirSync(sourceRoot, { withFileTypes: true }).filter((entry) => entry.isDirectory());

  for (const skill of skills) {
    const source = path.join(sourceRoot, skill.name);
    const destination = path.join(destinationRoot, skill.name);
    if (pathEntryExists(destination)) {
      try {
        if (fs.realpathSync(destination) === fs.realpathSync(source)) continue;
      } catch { /* Это другой или повреждённый путь. */ }
      if (!force) {
        console.warn(`Пропущен существующий скилл: ${destination}. Используйте --force для резервной копии.`);
        continue;
      }
      backupPath(destination);
    }

    try {
      fs.symlinkSync(source, destination, process.platform === "win32" ? "junction" : "dir");
    } catch {
      fs.cpSync(source, destination, { recursive: true });
      console.warn(`Ссылка недоступна, скилл скопирован: ${skill.name}`);
    }
  }
  console.log(`Скиллы подключены: ${destinationRoot}`);
}

function installSkills(clients, force) {
  const home = getInstallHome();
  if (clients.some((client) => ["codex", "opencode", "generic"].includes(client))) {
    installSkillSet(path.join(home, ".agents", "skills"), force);
  }
  if (clients.includes("claude")) {
    installSkillSet(path.join(home, ".claude", "skills"), force);
  }
}

function tomlString(value) {
  return JSON.stringify(value);
}

function codexBlock(config) {
  const sections = [MANAGED_BEGIN];
  if (config.jira?.enabled) {
    sections.push(`
[mcp_servers.testdocs_jira]
command = ${tomlString(process.execPath)}
args = [${tomlString(launcherFile)}, "jira"]
enabled = true
required = false
enabled_tools = [
  "get_issue", "get_transitions", "search_issues",
  "zephyr_get_projects", "zephyr_get_project", "zephyr_search_test_cases",
  "zephyr_get_test_plans", "zephyr_get_test_plan", "zephyr_get_iterations",
  "zephyr_get_test_case", "zephyr_get_all_test_cases"
]
default_tools_approval_mode = "approve"`);
  }
  if (config.confluence?.enabled) {
    sections.push(`
[mcp_servers.testdocs_confluence]
command = ${tomlString(process.execPath)}
args = [${tomlString(launcherFile)}, "confluence"]
enabled = true
required = false
enabled_tools = ["search", "get_page", "get_page_as_markdown", "get_space_pages", "get_page_children"]
default_tools_approval_mode = "approve"`);
  }
  sections.push(MANAGED_END);
  return `${sections.join("\n")}\n`;
}

function writeManagedCodexConfig(config) {
  const target = getCodexConfigFile();
  fs.mkdirSync(path.dirname(target), { recursive: true });
  const existing = fs.existsSync(target) ? fs.readFileSync(target, "utf8") : "";
  const escapedBegin = MANAGED_BEGIN.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const escapedEnd = MANAGED_END.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const managedPattern = new RegExp(`${escapedBegin}[\\s\\S]*?${escapedEnd}\\n?`, "g");
  const withoutManaged = existing.replace(managedPattern, "").trimEnd();
  const next = `${withoutManaged}${withoutManaged ? "\n\n" : ""}${codexBlock(config)}`;
  if (existing && existing !== next) fs.copyFileSync(target, `${target}.backup-${stamp}`);
  fs.writeFileSync(target, next, "utf8");
  console.log(`Codex настроен: ${target}`);
}

function stableMcpServerConfig(service) {
  return {
    type: "local",
    command: [process.execPath, launcherFile, service],
    cwd: repoRoot,
    enabled: true
  };
}

function v2McpServerConfig(service) {
  return {
    type: "local",
    command: [process.execPath, launcherFile, service],
    cwd: repoRoot,
    disabled: false,
    codemode: false
  };
}

function openCodeSnippet(config, format) {
  const servers = {};
  const buildServer = format === "v2" ? v2McpServerConfig : stableMcpServerConfig;
  if (config.jira?.enabled) servers.testdocs_jira = buildServer("jira");
  if (config.confluence?.enabled) servers.testdocs_confluence = buildServer("confluence");
  return {
    $schema: "https://opencode.ai/config.json",
    mcp: format === "v2" ? { servers } : servers
  };
}

function writeJsonWithBackup(target, value) {
  fs.mkdirSync(path.dirname(target), { recursive: true });
  if (fs.existsSync(target)) fs.copyFileSync(target, `${target}.backup-${stamp}`);
  fs.writeFileSync(target, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function commandAvailable(command) {
  return spawnSync(command, ["--version"], { stdio: "ignore" }).status === 0;
}

function detectOpenCodeFormat(data, requestedFormat) {
  const explicit = normalizeOpenCodeFormat(
    requestedFormat || process.env.TESTDOCS_OPENCODE_FORMAT
  );
  if (explicit) return explicit;
  if (commandAvailable("opencode2")) return "v2";
  if (commandAvailable("opencode")) return "stable";
  if (data.mcp?.servers) return "v2";
  return "stable";
}

function removeManagedOpenCodePermissions(data) {
  const managedActions = new Set([
    "testdocs_jira_add_comment",
    "testdocs_jira_transition_issue"
  ]);

  if (Array.isArray(data.permissions)) {
    data.permissions = data.permissions.filter((rule) => !managedActions.has(rule?.action));
    if (!data.permissions.length) delete data.permissions;
  }

  if (data.permission && typeof data.permission === "object" && !Array.isArray(data.permission)) {
    for (const action of managedActions) delete data.permission[action];
    if (!Object.keys(data.permission).length) delete data.permission;
  }
}

function ensureSafeFormatMigration(data, format) {
  const managedNames = new Set(["testdocs_jira", "testdocs_confluence"]);
  if (format === "stable" && data.mcp?.servers) {
    const foreignServers = Object.keys(data.mcp.servers).filter((name) => !managedNames.has(name));
    if (foreignServers.length) {
      throw new Error(
        `OpenCode-конфиг содержит V2 MCP-серверы (${foreignServers.join(", ")}). ` +
        "Запустите установщик с --opencode-format v2 или перенесите их вручную."
      );
    }
  }

  if (format === "v2" && data.mcp && !data.mcp.servers) {
    const foreignServers = Object.entries(data.mcp)
      .filter(([name, value]) => !managedNames.has(name) && value && typeof value === "object" && value.type)
      .map(([name]) => name);
    if (foreignServers.length) {
      throw new Error(
        `OpenCode-конфиг содержит stable MCP-серверы (${foreignServers.join(", ")}). ` +
        "Запустите установщик с --opencode-format stable или перенесите их вручную."
      );
    }
  }
}

function validateOpenCodeConfig(format, noCli) {
  if (noCli) return;
  const command = format === "v2" ? "opencode2" : "opencode";
  if (!commandAvailable(command)) return;
  const result = spawnSync(command, ["debug", "config"], {
    cwd: repoRoot,
    stdio: "ignore"
  });
  if (result.status !== 0) {
    throw new Error(
      `Клиент ${command} отклонил созданный конфиг. Проверьте резервную копию рядом с opencode.json.`
    );
  }
  console.log(`Конфигурация OpenCode проверена командой ${command} debug config.`);
}

function mergeOpenCodeConfig(config, args) {
  const requestedFormat = args.openCodeFormat;
  const target = getOpenCodeConfigFile();
  let data = { $schema: "https://opencode.ai/config.json" };
  if (fs.existsSync(target)) {
    try {
      data = JSON.parse(fs.readFileSync(target, "utf8"));
    } catch {
      const format = detectOpenCodeFormat({}, requestedFormat);
      const fallback = path.join(getConfigDir(), "client-snippets", `opencode-${format}.json`);
      writeJsonWithBackup(fallback, openCodeSnippet(config, format));
      console.warn(`OpenCode-конфиг содержит JSONC или нестандартный JSON. Готовый фрагмент: ${fallback}`);
      return;
    }
  }

  const format = detectOpenCodeFormat(data, requestedFormat);
  ensureSafeFormatMigration(data, format);
  removeManagedOpenCodePermissions(data);
  data.mcp ||= {};

  if (format === "stable") {
    if (data.mcp.servers) delete data.mcp.servers;
    delete data.mcp.testdocs_jira;
    delete data.mcp.testdocs_confluence;
    if (config.jira?.enabled) data.mcp.testdocs_jira = stableMcpServerConfig("jira");
    if (config.confluence?.enabled) {
      data.mcp.testdocs_confluence = stableMcpServerConfig("confluence");
    }
  } else {
    data.mcp.servers ||= {};
    delete data.mcp.testdocs_jira;
    delete data.mcp.testdocs_confluence;
    delete data.mcp.servers.testdocs_jira;
    delete data.mcp.servers.testdocs_confluence;
    if (config.jira?.enabled) data.mcp.servers.testdocs_jira = v2McpServerConfig("jira");
    if (config.confluence?.enabled) {
      data.mcp.servers.testdocs_confluence = v2McpServerConfig("confluence");
    }
  }
  writeJsonWithBackup(target, data);
  console.log(`OpenCode настроен (${format}): ${target}`);
  validateOpenCodeConfig(format, args.noCli);
}

function claudeCommands(config) {
  const commands = [];
  if (config.jira?.enabled) {
    commands.push(`claude mcp add --transport stdio --scope user testdocs_jira -- ${JSON.stringify(process.execPath)} ${JSON.stringify(launcherFile)} jira`);
  }
  if (config.confluence?.enabled) {
    commands.push(`claude mcp add --transport stdio --scope user testdocs_confluence -- ${JSON.stringify(process.execPath)} ${JSON.stringify(launcherFile)} confluence`);
  }
  return commands;
}

function configureClaude(config, noCli) {
  const commandsFile = path.join(getConfigDir(), "client-snippets", "claude-code.txt");
  fs.mkdirSync(path.dirname(commandsFile), { recursive: true });
  fs.writeFileSync(commandsFile, `${claudeCommands(config).join("\n")}\n`, "utf8");

  if (noCli || spawnSync("claude", ["--version"], { stdio: "ignore" }).status !== 0) {
    console.warn(`Claude Code CLI не найден или отключён. Команды сохранены: ${commandsFile}`);
    return;
  }

  for (const [service, enabled] of [["jira", config.jira?.enabled], ["confluence", config.confluence?.enabled]]) {
    if (!enabled) continue;
    const name = `testdocs_${service}`;
    const current = spawnSync("claude", ["mcp", "get", name], { stdio: "ignore" });
    if (current.status === 0) {
      console.log(`Claude Code уже содержит ${name}; регистрация пропущена.`);
      continue;
    }
    const added = spawnSync("claude", [
      "mcp", "add", "--transport", "stdio", "--scope", "user", name,
      "--", process.execPath, launcherFile, service
    ], { stdio: "inherit" });
    if (added.status !== 0) console.warn(`Не удалось добавить ${name}. Команды сохранены: ${commandsFile}`);
  }
}

function writeGenericSnippet(config) {
  const mcpServers = {};
  if (config.jira?.enabled) {
    mcpServers.testdocs_jira = { command: process.execPath, args: [launcherFile, "jira"] };
  }
  if (config.confluence?.enabled) {
    mcpServers.testdocs_confluence = { command: process.execPath, args: [launcherFile, "confluence"] };
  }
  const target = path.join(getConfigDir(), "client-snippets", "generic-mcp.json");
  writeJsonWithBackup(target, { mcpServers });
  console.log(`Универсальный MCP-фрагмент: ${target}`);
}

function configureClients(config, clients, args) {
  writeGenericSnippet(config);
  if (clients.includes("codex")) writeManagedCodexConfig(config);
  if (clients.includes("opencode")) mergeOpenCodeConfig(config, args);
  if (clients.includes("claude")) configureClaude(config, args.noCli);
}

function verifyInstallation() {
  console.log("\nПроверяю локальный MCP-handshake...");
  run(process.execPath, [path.join(repoRoot, "scripts", "check-install.mjs")]);
}

function authenticateBrowserSessions(config, args) {
  if (args.noCli || args.skipBrowserAuth) return;
  const services = ["jira", "confluence"].filter(
    (service) => config[service]?.enabled && config[service]?.authMode === "browser_session"
  );
  for (const service of services) {
    console.log(`\nПроверяю браузерную сессию ${service}...`);
    const result = spawnSync(process.execPath, [browserAuthFile, service], {
      cwd: repoRoot,
      stdio: "inherit"
    });
    if (result.status !== 0) {
      console.warn(
        `Браузерная авторизация ${service} не завершена. Позже выполните: npm run auth -- ${service}`
      );
    }
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) return showHelp();
  const major = Number(process.versions.node.split(".")[0]);
  if (major < 20) throw new Error(`Требуется Node.js 20 или новее. Найдена версия ${process.version}.`);

  console.log(`Testdocs Kit\nРепозиторий: ${repoRoot}\n`);
  const clients = await chooseClients(args);
  if (!clients.length) throw new Error("Не выбран ни один клиент.");
  const config = await collectConfig(args, clients);
  config.version ||= 1;
  config.clients = clients;
  config.enableWrites = false;
  applyCaFile(config, args.caFile);

  savePrivateConfig(config);
  installDependencies(args.skipDependencies, config);
  installSkills(clients, args.force);
  configureClients(config, clients, args);
  verifyInstallation();
  authenticateBrowserSessions(config, args);

  console.log(`\nУстановка завершена.
1. Перезапустите выбранный AI-клиент.
2. Проверьте MCP-командой клиента.
3. Выполните пробный запрос из README.md.

Внешние write-инструменты отключены.`);
}

main().catch((error) => {
  console.error(`\nОшибка установки: ${error.message}`);
  process.exit(1);
});
