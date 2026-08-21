#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import readline from "node:readline/promises";
import { spawnSync } from "node:child_process";
import { requiresShell } from "./command-shell.mjs";
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
import {
  connectionList,
  findConnection,
  hasQaTools,
  migrateConfig,
  nextConnectionId,
  serverName,
  usesZephyr
} from "./config-model.mjs";

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
    reuse: false,
    configure: null,
    add: null,
    openCodeFormat: null,
    caFile: null,
    enableJiraWrites: process.env.TESTDOCS_ENABLE_JIRA_WRITES === "1"
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--clients") result.clients = argv[++index]?.split(",");
    else if (arg === "--answers") result.answers = argv[++index];
    else if (arg === "--reuse") result.reuse = true;
    else if (arg === "--configure") result.configure = argv[++index];
    else if (arg === "--add") result.add = argv[++index];
    else if (arg === "--opencode-format") result.openCodeFormat = argv[++index];
    else if (arg === "--ca-file") result.caFile = argv[++index];
    else if (arg === "--enable-jira-writes") result.enableJiraWrites = true;
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
  --reuse                                 Применить сохранённые настройки без вопросов
  --configure jira|confluence|eva|tms|delivery|all
                                          Перенастроить только выбранную часть
  --add jira|confluence|eva               Добавить подключение, сохранив существующие
  --opencode-format stable|v2              Явно выбрать формат OpenCode
  --ca-file /path/to/ca-bundle.pem         Дополнительные доверенные CA в формате PEM
  --enable-jira-writes                     Разрешить создание Bug и публикацию checklist
                                          для сохранённых Jira-подключений
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

async function askReusable(question, previous = "", initial = "") {
  const keepHint = previous ? " (Enter — оставить текущее значение)" : "";
  return ask(`${question}${keepHint}`, previous || initial);
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

async function collectJira(previous = {}, id = "jira-main") {
  const enabled = await confirm("Подключить Jira", previous.enabled ?? true);
  if (!enabled) return { ...previous, id, enabled: false };

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
  const url = (await askReusable(
    "Адрес Jira без завершающего слеша",
    previous.url || "",
    "https://jira.company.example"
  )).replace(/\/+$/, "");
  const previousDefaultTemplate = previous.url
    ? `${String(previous.url).replace(/\/+$/, "")}/secure/Tests.jspa#/testCase/{key}`
    : null;
  const testCaseUrlTemplate = !previous.testCaseUrlTemplate || previous.testCaseUrlTemplate === previousDefaultTemplate
    ? `${url}/secure/Tests.jspa#/testCase/{key}`
    : previous.testCaseUrlTemplate;
  if (preset.authMode === "browser_session") {
    return {
      id,
      enabled: true,
      ...preset,
      url,
      username: "",
      secret: "",
      testCaseUrlTemplate,
      insecureTls: false
    };
  }
  const username = preset.authMode === "bearer"
    ? ""
    : await askReusable("Логин или email Jira", previous.username || "");
  const previousSecret = previous.profile === preset.profile ? previous.secret || "" : "";
  const secret = await askSecret(
    preset.authMode === "bearer" ? "PAT Jira" : profile === "1" ? "API-токен Jira" : "Пароль Jira",
    previousSecret
  );
  if (!secret) throw new Error("Не заполнены учётные данные Jira.");

  return {
    id,
    enabled: true,
    ...preset,
    url,
    username,
    secret,
    testCaseUrlTemplate,
    insecureTls: false
  };
}

async function collectConfluence(previous = {}, id = "confluence-main") {
  const enabled = await confirm("Подключить Confluence", previous.enabled ?? true);
  if (!enabled) return { ...previous, id, enabled: false };

  const profile = await ask(
    "Confluence: 1 — Cloud, 2 — Server/DC с PAT, 3 — логин и пароль, 4 — вход через браузер/SSO/2FA",
    previous.profile || "3"
  );
  const authMode = profile === "2" ? "bearer" : profile === "4" ? "browser_session" : "basic";
  const baseUrl = (await askReusable(
    "Адрес Confluence без завершающего слеша",
    previous.baseUrl || "",
    "https://confluence.company.example"
  )).replace(/\/+$/, "");
  if (authMode === "browser_session") {
    return {
      id,
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
    : await askReusable("Логин или email Confluence", previous.username || "");
  const previousSecret = previous.profile === profile ? previous.secret || "" : "";
  const secret = await askSecret(
    authMode === "bearer" ? "PAT Confluence" : profile === "1" ? "API-токен Confluence" : "Пароль Confluence",
    previousSecret
  );
  if (!secret) throw new Error("Не заполнены учётные данные Confluence.");

  return {
    id,
    enabled: true,
    profile,
    baseUrl,
    username,
    secret,
    authMode,
    insecureTls: false
  };
}

async function collectEva(previous = {}, id = "eva-main") {
  const enabled = await confirm("Подключить EvaProject и EvaWiki", previous.enabled ?? false);
  if (!enabled) return { ...previous, id, enabled: false };
  const baseUrl = (await askReusable(
    "Единый адрес Eva без завершающего слеша",
    previous.baseUrl || "",
    "https://eva.company.example"
  )).replace(/\/+$/, "");
  const previousSecret = previous.secret || "";
  const secret = (await askSecret("API-токен Eva", previousSecret)).trim();
  if (!secret) throw new Error("Не заполнен API-токен Eva.");
  return { id, enabled: true, baseUrl, authMode: "api_token", secret, insecureTls: false };
}

async function collectQaReport(previous = {}) {
  const enabled = await confirm("Подключить QA Report для открытия чек-листов в редакторе", previous.enabled ?? false);
  if (!enabled) return { ...previous, enabled: false };
  const baseUrl = (await askReusable(
    "Адрес QA Report без завершающего слеша",
    previous.baseUrl || "",
    "http://localhost:4173"
  )).replace(/\/+$/, "");
  return { enabled: true, baseUrl };
}

async function collectTms(previousTms = {}, previousQaTools = {}, previousWriteSetting = false, jiraItems = []) {
  const fallback = previousTms.category === "other" ? "2" : previousTms.category === "none" || !jiraItems.length ? "3" : "1";
  const categoryChoice = await ask(
    "TMS: 1 — Zephyr Scale / Test Management for Jira, 2 — другая TMS, 3 — TMS не используется",
    fallback
  );
  const category = categoryChoice === "2" ? "other" : categoryChoice === "3" ? "none" : "zephyr";
  if (category === "none") {
    return { tms: { category: "none", provider: "none" }, qaTools: { enabled: false }, enableQaToolsWrites: false };
  }
  if (category === "zephyr") {
    if (!jiraItems.length) throw new Error("Для Zephyr / Test Management for Jira сначала подключите Jira.");
    let jiraConnectionId = previousTms.jiraConnectionId || jiraItems[0].id;
    if (jiraItems.length > 1) {
      const options = jiraItems.map((item, index) => `${index + 1} — ${item.id} (${item.url})`).join(", ");
      const previousIndex = Math.max(0, jiraItems.findIndex((item) => item.id === jiraConnectionId));
      const selected = await ask(`К какой Jira привязана TMS: ${options}`, String(previousIndex + 1));
      jiraConnectionId = jiraItems[Number(selected) - 1]?.id || jiraConnectionId;
    }
    return {
      tms: { category: "zephyr", provider: "zephyr_scale", jiraConnectionId },
      qaTools: { enabled: false },
      enableQaToolsWrites: false
    };
  }

  const providerChoice = await ask(
    "Другая TMS: 1 — QA Tools (ТестОпс), 2 — другой MCP-провайдер (задел на будущее)",
    previousTms.provider === "custom" ? "2" : "1"
  );
  if (providerChoice === "2") {
    const name = await askReusable("Название TMS-провайдера", previousTms.name || "", "custom-tms");
    return {
      tms: { category: "other", provider: "custom", name, status: "not_configured" },
      qaTools: { enabled: false },
      enableQaToolsWrites: false
    };
  }

  const baseUrl = (await askReusable(
    "Адрес QA Tools (ТестОпс) без завершающего слеша",
    previousQaTools.baseUrl || "",
    "https://qa-tools.company.example"
  )).replace(/\/+$/, "");
  const authChoice = await ask(
    "Авторизация QA Tools: 1 — персональный API-токен (рекомендуется для MCP), 2 — логин и пароль (если инстанс разрешает password grant)",
    previousQaTools.authMode === "password" ? "2" : "1"
  );
  const authMode = authChoice === "2" || authChoice === "password" ? "password" : "api_token";
  const username = authMode === "password"
    ? await askReusable("Логин QA Tools", previousQaTools.username || "")
    : "";
  const previousSecret = previousQaTools.authMode === authMode ? previousQaTools.secret || "" : "";
  const enteredSecret = await askSecret(
    authMode === "password" ? "Пароль QA Tools" : "Персональный API-токен QA Tools",
    previousSecret
  );
  const secret = authMode === "api_token" ? enteredSecret.trim() : enteredSecret;
  if (authMode === "password" && !username) throw new Error("Не заполнен логин QA Tools.");
  if (!secret) throw new Error("Не заполнены учётные данные QA Tools.");
  const enableQaToolsWrites = await confirm(
    "Разрешить изменяющие инструменты QA Tools по явному запросу",
    previousWriteSetting === true
  );
  return {
    tms: { category: "other", provider: "qa_tools" },
    qaTools: { enabled: true, baseUrl, authMode, username, secret, insecureTls: false },
    enableQaToolsWrites
  };
}

function validateAnswers(config) {
  if (!config || typeof config !== "object") throw new Error("Файл ответов должен содержать JSON-объект.");
  config = migrateConfig(config);
  const validateUrl = (value, label) => {
    try {
      const parsed = new URL(value);
      if (!["http:", "https:"].includes(parsed.protocol)) throw new Error("unsupported protocol");
    } catch {
      throw new Error(`${label} должен быть полным HTTP(S)-адресом.`);
    }
  };
  for (const jira of connectionList(config, "jira")) {
    if (!jira.url || !jira.authMode || (jira.authMode !== "browser_session" && !jira.secret)) {
      throw new Error(`Не полностью настроена Jira ${jira.id}.`);
    }
    validateUrl(jira.url, `Адрес Jira ${jira.id}`);
    if (jira.testCaseUrlTemplate) {
      if (typeof jira.testCaseUrlTemplate !== "string" || !jira.testCaseUrlTemplate.includes("{key}")) {
        throw new Error(`testCaseUrlTemplate Jira ${jira.id} должен содержать {key}.`);
      }
      validateUrl(
        jira.testCaseUrlTemplate.replaceAll("{key}", "DEMO-T1").replaceAll("{projectKey}", "DEMO"),
        `testCaseUrlTemplate Jira ${jira.id}`
      );
    }
  }
  for (const confluence of connectionList(config, "confluence")) {
    if (!confluence.baseUrl || !confluence.authMode || (confluence.authMode !== "browser_session" && !confluence.secret)) {
      throw new Error(`Не полностью настроен Confluence ${confluence.id}.`);
    }
    validateUrl(confluence.baseUrl, `Адрес Confluence ${confluence.id}`);
  }
  for (const eva of connectionList(config, "eva")) {
    if (!eva.baseUrl || !eva.secret || eva.authMode !== "api_token") {
      throw new Error(`Не полностью настроена Eva ${eva.id}.`);
    }
    validateUrl(eva.baseUrl, `Адрес Eva ${eva.id}`);
  }
  if (config.qaReport?.enabled) {
    validateUrl(config.qaReport.baseUrl, "qaReport.baseUrl");
  }
  if (!["zephyr", "other", "none"].includes(config.tms?.category)) {
    throw new Error("Неизвестная категория TMS.");
  }
  if (config.tms.category === "zephyr") {
    if (!findConnection(config, "jira", config.tms.jiraConnectionId)) {
      throw new Error("Zephyr должен ссылаться на существующее подключение Jira.");
    }
  }
  if (hasQaTools(config)) {
    const qaTools = config.qaTools;
    if (!qaTools?.enabled || !qaTools.baseUrl || !qaTools.secret || !["api_token", "password"].includes(qaTools.authMode) || (qaTools.authMode === "password" && !qaTools.username)) {
      throw new Error("В файле ответов не полностью настроен QA Tools (ТестОпс).");
    }
    validateUrl(qaTools.baseUrl, "qaTools.baseUrl");
  }
  return config;
}

async function collectConnectionSet(config, type, collector, mode) {
  config.connections[type] ||= [];
  if (mode === "add") {
    const id = nextConnectionId(config, type);
    config.connections[type].push(await collector({ enabled: true }, id));
    return;
  }
  const enabled = connectionList(config, type);
  if (mode === "configure" && enabled.length > 1) {
    const options = enabled.map((item, index) => `${index + 1} — ${item.id}`).join(", ");
    const selected = await ask(`Какое подключение изменить: ${options}`, "1");
    const target = enabled[Number(selected) - 1] || enabled[0];
    const index = config.connections[type].findIndex((item) => item.id === target.id);
    config.connections[type][index] = await collector(target, target.id);
    return;
  }
  if (mode === "configure" && enabled.length === 1) {
    const index = config.connections[type].findIndex((item) => item.id === enabled[0].id);
    config.connections[type][index] = await collector(enabled[0], enabled[0].id);
    return;
  }
  if (!config.connections[type].length) {
    const first = await collector({ enabled: true }, `${type}-main`);
    config.connections[type] = [first];
  } else {
    const updated = [];
    for (const item of config.connections[type]) updated.push(await collector(item, item.id));
    config.connections[type] = updated;
  }
  while (await confirm(`Добавить ещё одно подключение ${type}`, false)) {
    const id = nextConnectionId(config, type);
    config.connections[type].push(await collector({}, id));
  }
}

async function collectConfig(args, clients, existing = null) {
  if (args.answers) {
    const answers = JSON.parse(fs.readFileSync(path.resolve(args.answers), "utf8"));
    return validateAnswers({ ...answers, clients });
  }

  const previousRaw = existing || readExistingConfig();
  if (args.reuse) {
    if (!Object.keys(previousRaw).length) throw new Error("Сохранённые настройки не найдены; выполните обычный npm run setup.");
    return validateAnswers({ ...migrateConfig(previousRaw), clients });
  }
  const previous = migrateConfig(previousRaw);
  previous.clients = clients;
  previous.connections ||= { jira: [], confluence: [], eva: [] };
  console.log("\nСекреты вводятся скрыто и сохраняются вне репозитория.\n");
  const target = args.add || args.configure || "all";
  if (args.add && !["jira", "confluence", "eva"].includes(args.add)) {
    throw new Error("--add поддерживает jira, confluence или eva.");
  }
  if (!["jira", "confluence", "eva", "tms", "delivery", "all"].includes(target)) {
    throw new Error("Неизвестный раздел настройки.");
  }
  const mode = args.add ? "add" : args.configure && args.configure !== "all" ? "configure" : "all";
  const freshFullSetup = target === "all" && !connectionList(previous, "jira").length && !connectionList(previous, "confluence").length && !connectionList(previous, "eva").length;
  if (freshFullSetup) {
    const sourceChoice = await ask(
      "Основная система: 1 — Jira + Confluence, 2 — EvaProject + EvaWiki, 3 — обе, 4 — без интеграций",
      "1"
    );
    if (["1", "3"].includes(sourceChoice)) {
      previous.connections.jira = [await collectJira({ enabled: true }, "jira-main")];
      previous.connections.confluence = [await collectConfluence({ enabled: true }, "confluence-main")];
    }
    if (["2", "3"].includes(sourceChoice)) {
      previous.connections.eva = [await collectEva({ enabled: true }, "eva-main")];
    }
    if (sourceChoice !== "4") {
      while (await confirm("Добавить ещё одну Jira", false)) {
        const id = nextConnectionId(previous, "jira");
        previous.connections.jira.push(await collectJira({}, id));
      }
    }
  } else {
    if (["all", "jira"].includes(target)) await collectConnectionSet(previous, "jira", collectJira, mode);
    if (["all", "eva"].includes(target)) await collectConnectionSet(previous, "eva", collectEva, mode);
    if (["all", "confluence"].includes(target)) await collectConnectionSet(previous, "confluence", collectConfluence, mode);
  }

  if (["all", "jira"].includes(target)) {
    for (const jira of connectionList(previous, "jira")) {
      jira.enableChecklistCommentPublication = await confirm(
        `Разрешить публикацию checklist в ${jira.id} по явному запросу`,
        jira.enableChecklistCommentPublication === true
      );
      jira.enableBugCreation = await confirm(
        `Разрешить создание багов в ${jira.id} по явному запросу`,
        jira.enableBugCreation === true
      );
    }
  }

  if (["all", "tms"].includes(target)) {
    Object.assign(previous, await collectTms(
      previous.tms,
      previous.qaTools,
      previous.enableQaToolsWrites,
      connectionList(previous, "jira")
    ));
  }
  if (["all", "delivery"].includes(target)) {
    previous.qaReport = await collectQaReport(previous.qaReport);
    previous.enableQaReportImport = previous.qaReport.enabled
      ? await confirm("Разрешить отправку checklist в QA Report по явному запросу", previous.enableQaReportImport === true)
      : false;
  }
  previous.version = 2;
  previous.enableWrites = false;
  previous.enableTestCaseCreation = true;
  return validateAnswers(previous);
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
  // Windows batch launchers such as npm.cmd must run through cmd.exe. Calling
  // them directly with spawnSync can fail with EINVAL on supported Node.js
  // versions, regardless of whether setup was started from Git Bash or PowerShell.
  const shell = requiresShell(command);
  const result = spawnSync(command, commandArgs, { stdio: "inherit", shell, ...options });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`Команда завершилась с кодом ${result.status}: ${command}`);
}

function installDependencies(skip, config) {
  const npm = process.platform === "win32" ? "npm.cmd" : "npm";
  const jiraDir = path.join(repoRoot, "mcp", "jira-mcp");
  const confluenceDir = path.join(repoRoot, "mcp", "confluence-mcp");
  const qaToolsDir = path.join(repoRoot, "mcp", "qa-tools-mcp");

  if (skip) {
    console.log("Установка зависимостей пропущена.");
    if (connectionList(config, "jira").length || (config.qaReport?.enabled && config.enableQaReportImport === true)) {
      const jiraSdk = path.join(jiraDir, "node_modules", "@modelcontextprotocol", "sdk", "package.json");
      if (!fs.existsSync(jiraSdk)) {
        throw new Error("Зависимости Jira MCP не установлены. Повторите команду без --skip-dependencies.");
      }
    }
    if (connectionList(config, "confluence").length) {
      const confluenceSdk = path.join(confluenceDir, "node_modules", "@modelcontextprotocol", "sdk", "package.json");
      const typescript = path.join(confluenceDir, "node_modules", ".bin", process.platform === "win32" ? "tsc.cmd" : "tsc");
      if (!fs.existsSync(confluenceSdk) || !fs.existsSync(typescript)) {
        throw new Error("Зависимости Confluence MCP не установлены. Повторите команду без --skip-dependencies.");
      }
    }
    if (hasQaTools(config) || connectionList(config, "eva").length) {
      const qaToolsSdk = path.join(qaToolsDir, "node_modules", "@modelcontextprotocol", "sdk", "package.json");
      if (!fs.existsSync(qaToolsSdk)) {
        throw new Error("Зависимости QA Tools MCP не установлены. Повторите команду без --skip-dependencies.");
      }
    }
    return;
  }
  if (connectionList(config, "jira").length || (config.qaReport?.enabled && config.enableQaReportImport === true)) {
    console.log("\nУстанавливаю зависимости Jira MCP...");
    run(npm, ["ci"], { cwd: jiraDir });
  }
  if (connectionList(config, "confluence").length) {
    console.log("\nУстанавливаю зависимости Confluence MCP...");
    run(npm, ["ci"], { cwd: confluenceDir });
  }
  if (hasQaTools(config) || connectionList(config, "eva").length) {
    console.log("\nУстанавливаю зависимости MCP proxy для QA Tools / Eva...");
    run(npm, ["ci"], { cwd: qaToolsDir });
  }
}

function buildAdapters(config) {
  if (!connectionList(config, "confluence").length) return;
  const npm = process.platform === "win32" ? "npm.cmd" : "npm";
  const confluenceDir = path.join(repoRoot, "mcp", "confluence-mcp");
  console.log("\nПересобираю Confluence MCP из актуальных исходников...");
  run(npm, ["run", "build"], { cwd: confluenceDir });
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

function configuredServers(config) {
  const servers = [];
  const jiraItems = connectionList(config, "jira");
  for (const jira of jiraItems) {
    const tools = ["get_issue", "jira_get_bug_create_metadata", "get_transitions", "search_issues"];
    if (jira.enableBugCreation === true) tools.push("jira_create_bug");
    if (jira.enableChecklistCommentPublication === true) tools.push("jira_publish_checklist_comment");
    if (usesZephyr(config, jira.id)) {
      tools.push(
        "zephyr_get_projects", "zephyr_get_project", "zephyr_search_test_cases",
        "zephyr_get_test_plans", "zephyr_get_test_plan", "zephyr_get_iterations",
        "zephyr_get_test_case", "zephyr_get_all_test_cases", "zephyr_create_test_case",
        "zephyr_update_session_test_case", "zephyr_update_test_case"
      );
    }
    servers.push({ name: serverName("jira", jira.id, jiraItems.length), service: "jira", id: jira.id, tools });
  }
  const confluenceItems = connectionList(config, "confluence");
  for (const item of confluenceItems) {
    servers.push({
      name: serverName("confluence", item.id, confluenceItems.length),
      service: "confluence",
      id: item.id,
      tools: ["search", "get_page", "get_page_as_markdown", "get_space_pages", "get_page_children"]
    });
  }
  const evaItems = connectionList(config, "eva");
  for (const item of evaItems) {
    servers.push({ name: serverName("eva", item.id, evaItems.length), service: "eva", id: item.id });
  }
  if (hasQaTools(config)) servers.push({ name: "testdocs_qa_tools", service: "qa_tools" });
  if (config.qaReport?.enabled && config.enableQaReportImport === true) {
    servers.push({ name: "testdocs_delivery", service: "delivery", tools: ["qa_report_import_checklist"] });
  }
  return servers;
}

function codexBlock(config) {
  const sections = [MANAGED_BEGIN];
  for (const server of configuredServers(config)) {
    const args = [launcherFile, server.service, ...(server.id ? [server.id] : [])];
    const enabledTools = server.tools?.length
      ? `\nenabled_tools = [${server.tools.map(tomlString).join(", ")}]`
      : "";
    sections.push(`
[mcp_servers.${server.name}]
command = ${tomlString(process.execPath)}
args = [${args.map(tomlString).join(", ")}]
enabled = true
required = false
${enabledTools}
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

function stableMcpServerConfig(service, id) {
  return {
    type: "local",
    command: [process.execPath, launcherFile, service, ...(id ? [id] : [])],
    cwd: repoRoot,
    enabled: true
  };
}

function v2McpServerConfig(service, id) {
  return {
    type: "local",
    command: [process.execPath, launcherFile, service, ...(id ? [id] : [])],
    cwd: repoRoot,
    disabled: false,
    codemode: false
  };
}

function openCodeSnippet(config, format) {
  const servers = {};
  const buildServer = format === "v2" ? v2McpServerConfig : stableMcpServerConfig;
  for (const server of configuredServers(config)) servers[server.name] = buildServer(server.service, server.id);
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
  const isManaged = (name) => /^testdocs_(jira|confluence|eva)(_|$)/.test(name) || ["testdocs_delivery", "testdocs_qa_tools"].includes(name);
  if (format === "stable" && data.mcp?.servers) {
    const foreignServers = Object.keys(data.mcp.servers).filter((name) => !isManaged(name));
    if (foreignServers.length) {
      throw new Error(
        `OpenCode-конфиг содержит V2 MCP-серверы (${foreignServers.join(", ")}). ` +
        "Запустите установщик с --opencode-format v2 или перенесите их вручную."
      );
    }
  }

  if (format === "v2" && data.mcp && !data.mcp.servers) {
    const foreignServers = Object.entries(data.mcp)
      .filter(([name, value]) => !isManaged(name) && value && typeof value === "object" && value.type)
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
  const removeManaged = (container) => {
    if (!container || typeof container !== "object") return;
    for (const name of Object.keys(container)) {
      if (/^testdocs_(jira|confluence|eva)(_|$)/.test(name) || ["testdocs_delivery", "testdocs_qa_tools"].includes(name)) {
        delete container[name];
      }
    }
  };
  const configured = configuredServers(config);

  if (format === "stable") {
    if (data.mcp.servers) delete data.mcp.servers;
    removeManaged(data.mcp);
    for (const server of configured) data.mcp[server.name] = stableMcpServerConfig(server.service, server.id);
  } else {
    data.mcp.servers ||= {};
    removeManaged(data.mcp);
    removeManaged(data.mcp.servers);
    for (const server of configured) data.mcp.servers[server.name] = v2McpServerConfig(server.service, server.id);
  }
  writeJsonWithBackup(target, data);
  console.log(`OpenCode настроен (${format}): ${target}`);
  validateOpenCodeConfig(format, args.noCli);
}

function claudeCommands(config) {
  return configuredServers(config).map((server) =>
    `claude mcp add --transport stdio --scope user ${server.name} -- ${JSON.stringify(process.execPath)} ${JSON.stringify(launcherFile)} ${server.service}${server.id ? ` ${server.id}` : ""}`
  );
}

function configureClaude(config, noCli) {
  const commandsFile = path.join(getConfigDir(), "client-snippets", "claude-code.txt");
  fs.mkdirSync(path.dirname(commandsFile), { recursive: true });
  fs.writeFileSync(commandsFile, `${claudeCommands(config).join("\n")}\n`, "utf8");

  if (noCli || spawnSync("claude", ["--version"], { stdio: "ignore" }).status !== 0) {
    console.warn(`Claude Code CLI не найден или отключён. Команды сохранены: ${commandsFile}`);
    return;
  }

  for (const server of configuredServers(config)) {
    const current = spawnSync("claude", ["mcp", "get", server.name], { stdio: "ignore" });
    if (current.status === 0) {
      console.log(`Claude Code уже содержит ${server.name}; регистрация пропущена.`);
      continue;
    }
    const added = spawnSync("claude", [
      "mcp", "add", "--transport", "stdio", "--scope", "user", server.name,
      "--", process.execPath, launcherFile, server.service, ...(server.id ? [server.id] : [])
    ], { stdio: "inherit" });
    if (added.status !== 0) console.warn(`Не удалось добавить ${server.name}. Команды сохранены: ${commandsFile}`);
  }
}

function writeGenericSnippet(config) {
  const mcpServers = {};
  for (const server of configuredServers(config)) {
    mcpServers[server.name] = {
      command: process.execPath,
      args: [launcherFile, server.service, ...(server.id ? [server.id] : [])]
    };
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

function verifyInstallation(args) {
  console.log("\nПроверяю локальный MCP-handshake...");
  const checkArgs = [path.join(repoRoot, "scripts", "check-install.mjs")];
  if (args.noCli) checkArgs.push("--offline-external");
  run(process.execPath, checkArgs);
}

function authenticateBrowserSessions(config, args) {
  if (args.noCli || args.skipBrowserAuth) return;
  const entries = ["jira", "confluence"].flatMap((service) =>
    connectionList(config, service)
      .filter((entry) => entry.authMode === "browser_session")
      .map((entry) => ({ service, id: entry.id }))
  );
  for (const { service, id } of entries) {
    console.log(`\nПроверяю браузерную сессию ${service}/${id}...`);
    const result = spawnSync(process.execPath, [browserAuthFile, service, id], {
      cwd: repoRoot,
      stdio: "inherit"
    });
    if (result.status !== 0) {
      console.warn(
        `Браузерная авторизация ${service}/${id} не завершена. Позже выполните: npm run auth -- ${service} ${id}`
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
  const existing = readExistingConfig();
  const clients = args.clients
    ? normalizeClients(args.clients)
    : (args.reuse || args.configure || args.add) && Array.isArray(existing.clients)
      ? normalizeClients(existing.clients)
      : await chooseClients(args);
  if (!clients.length) throw new Error("Не выбран ни один клиент.");
  const config = await collectConfig(args, clients, existing);
  config.version = 2;
  config.clients = clients;
  config.enableWrites = false;
  config.enableTestCaseCreation = true;
  if (args.enableJiraWrites) {
    const jiraConnections = connectionList(config, "jira");
    if (!jiraConnections.length) {
      throw new Error("Нельзя включить Jira write-инструменты: сохранённые Jira-подключения не найдены.");
    }
    for (const jira of jiraConnections) {
      jira.enableBugCreation = true;
      jira.enableChecklistCommentPublication = true;
    }
    console.log("Разрешены защищённые Jira-инструменты создания Bug и публикации checklist по явному запросу.");
  }
  config.tms ||= { category: "none", provider: "none" };
  for (const jira of connectionList(config, "jira")) {
    jira.testCaseUrlTemplate ||= `${jira.url}/secure/Tests.jspa#/testCase/{key}`;
  }
  applyCaFile(config, args.caFile);

  savePrivateConfig(config);
  installDependencies(args.skipDependencies, config);
  installSkills(clients, args.force);
  configureClients(config, clients, args);
  // Register independent MCP services before an optional adapter build can fail.
  buildAdapters(config);
  verifyInstallation(args);
  authenticateBrowserSessions(config, args);

  const tmsSummary = hasQaTools(config)
    ? "QA Tools подключён через официальный MCP; изменяющие tools требуют отдельного разрешения и явного запроса, удаление скрыто."
    : config.tms.category === "zephyr"
      ? "Создание новых Zephyr/TM4J-кейсов доступно только по явному запросу.\nСуществующий кейс обновляется только по явному запросу после повторного чтения и проверки актуальности proposal."
      : "TMS-интеграция не подключена.";
  console.log(`\nУстановка завершена.
1. Перезапустите выбранный AI-клиент.
2. Проверьте MCP-командой клиента.
3. Выполните пробный запрос из README.md.

${tmsSummary}
Checklist-комментарии Jira и QA Report доступны только если были отдельно разрешены при setup. Автоматическое удаление внешних тест-кейсов отключено.`);
}

main().catch((error) => {
  console.error(`\nОшибка установки: ${error.message}`);
  process.exit(1);
});
