#!/usr/bin/env node

import fs from "node:fs";
import { defaultFigmaMode, isFigmaDesktop } from "./figma-config.mjs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const scriptsDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptsDir, "..");
const testRoot = fs.mkdtempSync(path.join(os.tmpdir(), "testdocs-kit-installer-"));
const answersFile = path.join(testRoot, "answers.json");

const answers = {
  version: 1,
  enableWrites: false,
  enableBugCreation: true,
  enableChecklistCommentPublication: true,
  enableReleaseTestRunCreation: true,
  enableQaReportImport: true,
  tms: { provider: "zephyr_scale" },
  jira: {
    enabled: true,
    profile: "3",
    url: "https://jira.example.invalid",
    username: "tester",
    secret: "dummy-jira-password",
    authMode: "basic",
    apiVersion: "2",
    insecureTls: false
  },
  confluence: {
    enabled: true,
    profile: "3",
    baseUrl: "https://confluence.example.invalid",
    username: "tester",
    secret: "dummy-confluence-password",
    authMode: "basic",
    insecureTls: false
  },
  qaReport: {
    enabled: true,
    baseUrl: "http://qa-report.example.invalid:4173"
  }
};

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

try {
  fs.writeFileSync(answersFile, JSON.stringify(answers), "utf8");
  const env = {
    ...process.env,
    HOME: testRoot,
    XDG_CONFIG_HOME: path.join(testRoot, ".config"),
    TESTDOCS_INSTALL_ROOT: testRoot,
    TESTDOCS_CONFIG_DIR: path.join(testRoot, "private-config"),
    TESTDOCS_CODEX_CONFIG: path.join(testRoot, "codex", "config.toml"),
    TESTDOCS_OPENCODE_CONFIG: path.join(testRoot, ".config", "opencode", "opencode.json"),
    TESTDOCS_OPENCODE_FORMAT: "stable"
  };

  const installArgs = [
    path.join(scriptsDir, "install.mjs"),
    "--clients", "codex,claude,opencode,generic",
    "--answers", answersFile,
    "--ca-file", path.join(repoRoot, "certificates", "globalsign-gcc-r3-dv-tls-ca-2020.pem"),
    "--skip-dependencies",
    "--no-cli"
  ];
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    const result = spawnSync(process.execPath, installArgs, { cwd: repoRoot, env, encoding: "utf8" });
    if (result.status !== 0) {
      process.stdout.write(result.stdout || "");
      process.stderr.write(result.stderr || "");
      throw new Error(`Установщик завершился с кодом ${result.status} на попытке ${attempt}`);
    }
    assert(
      result.stdout.includes("Пересобираю Confluence MCP из актуальных исходников"),
      "С флагом --skip-dependencies не пересобран Confluence MCP."
    );
    assert(
      result.stdout.indexOf("Codex настроен:") < result.stdout.indexOf("Пересобираю Confluence MCP из актуальных исходников"),
      "MCP-сервисы не зарегистрированы до независимой пересборки Confluence."
    );
  }

  const privateConfig = path.join(testRoot, "private-config", "config.json");
  const codexConfig = path.join(testRoot, "codex", "config.toml");
  const openCodeConfig = path.join(testRoot, ".config", "opencode", "opencode.json");
  const genericConfig = path.join(testRoot, "private-config", "client-snippets", "generic-mcp.json");

  for (const file of [privateConfig, codexConfig, openCodeConfig, genericConfig]) {
    assert(fs.existsSync(file), `Не создан ${file}`);
  }
  const savedPrivateConfig = JSON.parse(fs.readFileSync(privateConfig, "utf8"));
  assert(savedPrivateConfig.version === 3, "Старый конфиг не мигрирован в version 3.");
  assert(savedPrivateConfig.caFile?.endsWith("globalsign-gcc-r3-dv-tls-ca-2020.pem"), "Не сохранён CA-файл.");
  assert(savedPrivateConfig.enableTestCaseCreation === true, "Не включены создание и защищённое исправление кейса Zephyr.");
  assert(savedPrivateConfig.connections.jira[0].enableBugCreation === true, "Не включено создание багов Jira по явному запросу.");
  assert(savedPrivateConfig.connections.jira[0].enableChecklistCommentPublication === true, "Не включена явная публикация checklist в Jira.");
  assert(savedPrivateConfig.connections.jira[0].enableReleaseTestRunCreation === true, "Не включено защищённое создание Test Run и связанной QA-задачи.");
  assert(savedPrivateConfig.enableQaReportImport === true, "Не включён импорт checklist в QA Report.");
  assert(
    savedPrivateConfig.connections.jira[0].testCaseUrlTemplate === "https://jira.example.invalid/secure/Tests.jspa#/testCase/{key}",
    "Не сохранён шаблон полной ссылки на кейс Zephyr."
  );
  assert(fs.existsSync(path.join(testRoot, ".agents", "skills", "generate-test-cases", "SKILL.md")), "Не установлены Agent Skills.");
  assert(fs.existsSync(path.join(testRoot, ".claude", "skills", "generate-test-cases", "SKILL.md")), "Не установлены Claude Skills.");
  assert(fs.existsSync(path.join(testRoot, ".agents", "skills", "prepare-task-testing", "SKILL.md")), "Не установлен task-first skill.");
  assert(fs.existsSync(path.join(testRoot, ".agents", "skills", "create-bug-report", "SKILL.md")), "Не установлен skill создания баг-репортов.");
  assert(fs.existsSync(path.join(testRoot, ".agents", "skills", "create-release-test-run", "SKILL.md")), "Не установлен skill формирования Test Run.");
  assert(fs.existsSync(path.join(testRoot, ".agents", "skills", "explain-task-testing", "SKILL.md")), "Не установлен skill объяснения тестирования.");
  assert(fs.existsSync(path.join(testRoot, ".agents", "skills", "execute-task-testing", "SKILL.md")), "Не установлен skill выполнения тестирования.");
  assert(fs.existsSync(path.join(testRoot, ".claude", "skills", "generate-test-checklist", "SKILL.md")), "Не установлен checklist skill для Claude.");

  const publicConfigs = [codexConfig, openCodeConfig, genericConfig].map((file) => fs.readFileSync(file, "utf8")).join("\n");
  assert(!publicConfigs.includes("dummy-jira-password"), "Секрет Jira попал в клиентскую конфигурацию.");
  assert(!publicConfigs.includes("dummy-confluence-password"), "Секрет Confluence попал в клиентскую конфигурацию.");
  assert(
    fs.readFileSync(codexConfig, "utf8").split("# BEGIN testdocs-kit").length - 1 === 1,
    "Повторный запуск продублировал Codex-конфигурацию."
  );
  assert(fs.readFileSync(codexConfig, "utf8").includes("jira_publish_checklist_comment"), "Codex не получил разрешённый checklist-comment tool.");
  assert(fs.readFileSync(codexConfig, "utf8").includes("jira_create_bug"), "Codex не получил разрешённый tool создания багов.");
  assert(fs.readFileSync(codexConfig, "utf8").includes("zephyr_create_test_run"), "Codex не получил разрешённый tool создания Test Run.");
  assert(fs.readFileSync(codexConfig, "utf8").includes("jira_create_qa_work_item"), "Codex не получил разрешённый tool создания связанной QA-задачи.");
  assert(fs.readFileSync(codexConfig, "utf8").includes("testdocs_delivery"), "Codex не получил QA Report MCP.");
  assert(JSON.parse(fs.readFileSync(genericConfig, "utf8")).mcpServers?.testdocs_delivery, "Generic client не получил QA Report MCP.");

  const openCode = JSON.parse(fs.readFileSync(openCodeConfig, "utf8"));
  assert(openCode.mcp?.testdocs_jira, "Не добавлен OpenCode stable Jira MCP.");
  assert(openCode.mcp?.testdocs_confluence, "Не добавлен OpenCode stable Confluence MCP.");
  assert(openCode.mcp?.testdocs_delivery, "Не добавлен OpenCode stable QA Report MCP.");
  assert(!openCode.permissions, "В stable-конфиг попало несовместимое поле permissions.");
  if (spawnSync("opencode", ["--version"], { env, stdio: "ignore" }).status === 0) {
    const validation = spawnSync("opencode", ["debug", "config"], {
      cwd: repoRoot,
      env,
      stdio: "ignore"
    });
    assert(validation.status === 0, "OpenCode отклонил stable-конфиг установщика.");
  }

  // Конфиг, созданный ошибочной версией установщика, должен мигрировать в stable.
  fs.writeFileSync(openCodeConfig, JSON.stringify({
    $schema: "https://opencode.ai/config.json",
    mcp: {
      servers: {
        testdocs_jira: { type: "local", command: ["node", "old-jira.js"] },
        testdocs_confluence: { type: "local", command: ["node", "old-confluence.js"] }
      }
    },
    permissions: [
      { action: "testdocs_jira_add_comment", resource: "*", effect: "deny" },
      { action: "testdocs_jira_transition_issue", resource: "*", effect: "deny" }
    ]
  }), "utf8");
  const migrationResult = spawnSync(process.execPath, [
    path.join(scriptsDir, "install.mjs"),
    "--clients", "opencode",
    "--answers", answersFile,
    "--skip-dependencies",
    "--no-cli"
  ], { cwd: repoRoot, env, encoding: "utf8" });
  assert(migrationResult.status === 0, "Не исправлен ошибочный OpenCode-конфиг.");
  const migratedOpenCode = JSON.parse(fs.readFileSync(openCodeConfig, "utf8"));
  assert(migratedOpenCode.mcp?.testdocs_jira, "После миграции не добавлен stable Jira MCP.");
  assert(!migratedOpenCode.mcp?.servers, "После миграции осталось поле mcp.servers.");
  assert(!migratedOpenCode.permissions, "После миграции осталось поле permissions.");
  if (spawnSync("opencode", ["--version"], { env, stdio: "ignore" }).status === 0) {
    const migratedValidation = spawnSync("opencode", ["debug", "config"], {
      cwd: repoRoot,
      env,
      stdio: "ignore"
    });
    assert(migratedValidation.status === 0, "OpenCode отклонил исправленный stable-конфиг.");
  }

  // Экспериментальный OpenCode V2 остаётся доступен явным выбором.
  fs.writeFileSync(openCodeConfig, JSON.stringify({
    $schema: "https://opencode.ai/config.json",
    mcp: {
      servers: {
        existing_server: { type: "local", command: ["node", "existing.js"] }
      }
    }
  }), "utf8");
  const v2Result = spawnSync(process.execPath, [
    path.join(scriptsDir, "install.mjs"),
    "--clients", "opencode",
    "--answers", answersFile,
    "--skip-dependencies",
    "--no-cli",
    "--opencode-format", "v2"
  ], { cwd: repoRoot, env, encoding: "utf8" });
  assert(v2Result.status === 0, "Не установлена конфигурация OpenCode V2.");
  const v2OpenCode = JSON.parse(fs.readFileSync(openCodeConfig, "utf8"));
  assert(v2OpenCode.mcp?.servers?.existing_server, "Потерян существующий OpenCode V2 MCP.");
  assert(v2OpenCode.mcp?.servers?.testdocs_jira, "Не добавлен OpenCode V2 Jira MCP.");
  assert(!v2OpenCode.permissions, "В OpenCode V2 без необходимости добавлено поле permissions.");

  // Browser-session mode must not require a password and must not open a browser in test mode.
  fs.writeFileSync(answersFile, JSON.stringify({
    version: 1,
    enableWrites: false,
    jira: {
      enabled: true,
      profile: "4",
      url: "https://jira.example.invalid",
      username: "",
      secret: "",
      authMode: "browser_session",
      apiVersion: "2",
      insecureTls: false
    },
    confluence: {
      enabled: true,
      profile: "4",
      baseUrl: "https://confluence.example.invalid",
      username: "",
      secret: "",
      authMode: "browser_session",
      insecureTls: false
    }
  }), "utf8");
  const browserSessionResult = spawnSync(process.execPath, [
    path.join(scriptsDir, "install.mjs"),
    "--clients", "opencode",
    "--answers", answersFile,
    "--skip-dependencies",
    "--no-cli",
    "--skip-browser-auth",
    "--opencode-format", "v2"
  ], { cwd: repoRoot, env, encoding: "utf8" });
  if (browserSessionResult.status !== 0) {
    process.stdout.write(browserSessionResult.stdout || "");
    process.stderr.write(browserSessionResult.stderr || "");
    throw new Error("Не установлен режим браузерной сессии без пароля.");
  }
  const browserPrivateConfig = JSON.parse(fs.readFileSync(privateConfig, "utf8"));
  assert(browserPrivateConfig.connections.jira[0].authMode === "browser_session", "Не сохранён browser_session для Jira.");
  assert(browserPrivateConfig.connections.confluence[0].authMode === "browser_session", "Не сохранён browser_session для Confluence.");

  // QA Report delivery remains independently usable without Jira or Confluence.
  fs.writeFileSync(answersFile, JSON.stringify({
    version: 1,
    enableWrites: false,
    enableTestCaseCreation: false,
    enableChecklistCommentPublication: false,
    enableQaReportImport: true,
    jira: { enabled: false },
    confluence: { enabled: false },
    qaReport: { enabled: true, baseUrl: "http://qa-report.example.invalid:4173" }
  }), "utf8");
  const qaOnlyResult = spawnSync(process.execPath, [
    path.join(scriptsDir, "install.mjs"),
    "--clients", "generic",
    "--answers", answersFile,
    "--skip-dependencies",
    "--no-cli"
  ], { cwd: repoRoot, env, encoding: "utf8" });
  if (qaOnlyResult.status !== 0) {
    process.stdout.write(qaOnlyResult.stdout || "");
    process.stderr.write(qaOnlyResult.stderr || "");
    throw new Error("Не установлена независимая QA Report integration.");
  }
  assert(qaOnlyResult.stdout.includes("QA Report: 1 инструмент"), "QA Report MCP не прошёл независимый handshake.");

  // QA Tools can be selected independently and keeps login/password out of client configs.
  fs.writeFileSync(answersFile, JSON.stringify({
    version: 1,
    enableWrites: false,
    enableTestCaseCreation: false,
    enableQaToolsWrites: true,
    tms: { provider: "qa_tools" },
    jira: { enabled: false },
    confluence: { enabled: false },
    qaTools: {
      enabled: true,
      baseUrl: "https://qa-tools.company.example",
      authMode: "password",
      username: "qa-user",
      secret: "dummy-qa-tools-password",
      insecureTls: false
    }
  }), "utf8");
  const qaToolsResult = spawnSync(process.execPath, [
    path.join(scriptsDir, "install.mjs"),
    "--clients", "codex,opencode,generic",
    "--answers", answersFile,
    "--skip-dependencies",
    "--no-cli",
    "--opencode-format", "v2"
  ], { cwd: repoRoot, env, encoding: "utf8" });
  if (qaToolsResult.status !== 0) {
    process.stdout.write(qaToolsResult.stdout || "");
    process.stderr.write(qaToolsResult.stderr || "");
    throw new Error("Не установлена QA Tools integration.");
  }
  const qaToolsPrivateConfig = JSON.parse(fs.readFileSync(privateConfig, "utf8"));
  assert(qaToolsPrivateConfig.tms.category === "other" && qaToolsPrivateConfig.tms.provider === "qa_tools", "Не сохранён выбор QA Tools.");
  assert(qaToolsPrivateConfig.qaTools.authMode === "password", "Не сохранён режим логин/пароль QA Tools.");
  const qaToolsPublicConfigs = [codexConfig, openCodeConfig, genericConfig].map((file) => fs.readFileSync(file, "utf8")).join("\n");
  assert(qaToolsPublicConfigs.includes("testdocs_qa_tools"), "QA Tools MCP не добавлен в клиентские конфиги.");
  assert(!qaToolsPublicConfigs.includes("qa-user"), "Логин QA Tools попал в клиентскую конфигурацию.");
  assert(!qaToolsPublicConfigs.includes("dummy-qa-tools-password"), "Пароль QA Tools попал в клиентскую конфигурацию.");
  assert(!qaToolsPublicConfigs.includes("zephyr_get_test_case"), "Zephyr tools остались при выбранном QA Tools.");
  assert(qaToolsResult.stdout.includes("QA Tools MCP proxy"), "Не проверен локальный QA Tools MCP proxy.");

  // Version 2 supports multiple Jira connections and one Eva endpoint for tasks and documents.
  fs.writeFileSync(answersFile, JSON.stringify({
    version: 2,
    enableWrites: false,
    enableTestCaseCreation: true,
    clients: ["codex", "generic"],
    connections: {
      jira: [
        {
          id: "jira-one",
          enabled: true,
          profile: "3",
          url: "https://jira-one.example.invalid",
          username: "tester-one",
          secret: "dummy-jira-one-password",
          authMode: "basic",
          apiVersion: "2",
          enableBugCreation: false,
          enableChecklistCommentPublication: false,
          enableReleaseTestRunCreation: false
        },
        {
          id: "jira-two",
          enabled: true,
          profile: "2",
          url: "https://jira-two.example.invalid",
          username: "",
          secret: "dummy-jira-two-token",
          authMode: "bearer",
          apiVersion: "2",
          enableBugCreation: true,
          enableChecklistCommentPublication: true,
          enableReleaseTestRunCreation: false
        }
      ],
      confluence: [],
      eva: [{
        id: "eva-main",
        enabled: true,
        baseUrl: "https://eva.example.invalid",
        authMode: "api_token",
        secret: "dummy-eva-token"
      }]
    },
    tms: { category: "zephyr", provider: "zephyr_scale", jiraConnectionId: "jira-two" },
    qaReport: { enabled: false }
  }), "utf8");
  const multiResult = spawnSync(process.execPath, [
    path.join(scriptsDir, "install.mjs"),
    "--clients", "codex,generic",
    "--answers", answersFile,
    "--skip-dependencies",
    "--no-cli"
  ], { cwd: repoRoot, env, encoding: "utf8" });
  if (multiResult.status !== 0) {
    process.stdout.write(multiResult.stdout || "");
    process.stderr.write(multiResult.stderr || "");
    throw new Error("Не установлены несколько Jira и Eva.");
  }
  const multiPrivateConfig = JSON.parse(fs.readFileSync(privateConfig, "utf8"));
  assert(multiPrivateConfig.connections.jira.length === 2, "Не сохранены две Jira.");
  assert(multiPrivateConfig.connections.eva.length === 1, "Не сохранена Eva.");
  assert(!Object.hasOwn(multiPrivateConfig.connections.eva[0], "command"), "В Eva-конфиге осталось внешнее поле command.");
  const multiGeneric = JSON.parse(fs.readFileSync(genericConfig, "utf8"));
  assert(multiGeneric.mcpServers.testdocs_jira_jira_one, "Не зарегистрирована первая Jira.");
  assert(multiGeneric.mcpServers.testdocs_jira_jira_two, "Не зарегистрирована вторая Jira.");
  assert(multiGeneric.mcpServers.testdocs_eva, "Не зарегистрирована Eva.");
  const multiPublic = [codexConfig, genericConfig].map((file) => fs.readFileSync(file, "utf8")).join("\n");
  for (const secret of ["dummy-jira-one-password", "dummy-jira-two-token", "dummy-eva-token"]) {
    assert(!multiPublic.includes(secret), `Секрет ${secret} попал в клиентский конфиг.`);
  }
  assert(multiResult.stdout.includes("Eva eva-main: встроенный read-only MCP проверен"), "Не проверен встроенный Eva MCP.");

  const beforeReuse = fs.readFileSync(privateConfig, "utf8");
  const reuseResult = spawnSync(process.execPath, [
    path.join(scriptsDir, "install.mjs"),
    "--clients", "generic",
    "--reuse",
    "--skip-dependencies",
    "--no-cli"
  ], { cwd: repoRoot, env, encoding: "utf8" });
  assert(reuseResult.status === 0, "Не применены сохранённые настройки через --reuse.");
  const afterReuse = JSON.parse(fs.readFileSync(privateConfig, "utf8"));
  const beforeReuseParsed = JSON.parse(beforeReuse);
  assert(JSON.stringify(afterReuse.connections) === JSON.stringify(beforeReuseParsed.connections), "--reuse изменил подключения или секреты.");
  assert(JSON.stringify(afterReuse.tms) === JSON.stringify(beforeReuseParsed.tms), "--reuse изменил TMS.");

  const enableReleaseRunResult = spawnSync(process.execPath, [
    path.join(scriptsDir, "install.mjs"),
    "--clients", "generic",
    "--reuse",
    "--enable-release-test-run-writes",
    "--skip-dependencies",
    "--no-cli"
  ], { cwd: repoRoot, env, encoding: "utf8" });
  assert(enableReleaseRunResult.status === 0, "Не включены узкие Test Run write-инструменты.");
  const afterEnableReleaseRun = JSON.parse(fs.readFileSync(privateConfig, "utf8"));
  const firstJira = afterEnableReleaseRun.connections.jira.find((jira) => jira.id === "jira-one");
  const zephyrJira = afterEnableReleaseRun.connections.jira.find((jira) => jira.id === "jira-two");
  assert(firstJira.enableReleaseTestRunCreation === false, "Узкий opt-in включил Test Run для посторонней Jira.");
  assert(zephyrJira.enableReleaseTestRunCreation === true, "Узкий opt-in не включил Test Run для выбранной Zephyr Jira.");
  assert(firstJira.enableBugCreation === false && firstJira.enableChecklistCommentPublication === false, "Узкий opt-in включил посторонние Jira writes.");
  assert(enableReleaseRunResult.stdout.includes("Разрешены только Test Run и связанная QA-задача для jira-two"), "Узкий opt-in не сообщил точное подключение.");

  const enableWritesResult = spawnSync(process.execPath, [
    path.join(scriptsDir, "install.mjs"),
    "--clients", "generic",
    "--reuse",
    "--skip-dependencies",
    "--no-cli"
  ], {
    cwd: repoRoot,
    env: { ...env, TESTDOCS_ENABLE_JIRA_WRITES: "1" },
    encoding: "utf8"
  });
  assert(enableWritesResult.status === 0, "Не включены защищённые Jira write-инструменты через --reuse.");
  const afterEnableWrites = JSON.parse(fs.readFileSync(privateConfig, "utf8"));
  assert(
    afterEnableWrites.connections.jira.every((jira) =>
      jira.enableBugCreation === true &&
      jira.enableChecklistCommentPublication === true &&
      jira.enableReleaseTestRunCreation === true
    ),
    "TESTDOCS_ENABLE_JIRA_WRITES не включил создание Bug, публикацию checklist, Test Run и QA-задачи для всех Jira-подключений."
  );
  assert(afterEnableWrites.enableWrites === false, "TESTDOCS_ENABLE_JIRA_WRITES включил общие небезопасные Jira-записи.");

  fs.writeFileSync(answersFile, JSON.stringify({
    version: 3,
    enableWrites: false,
    clients: ["codex", "opencode", "generic"],
    connections: {
      jira: [],
      confluence: [],
      eva: [],
      mcp: [
        { id: "figma", provider: "figma", enabled: true, kind: "remote", url: "https://mcp.figma.com/mcp", authMode: "oauth" },
        { id: "gitlab", provider: "gitlab", enabled: true, kind: "remote", url: "https://gitlab.example.invalid/api/v4/mcp", authMode: "oauth" },
        { id: "postman", provider: "postman", enabled: true, kind: "remote", url: "https://mcp.postman.com/mcp", authMode: "oauth" },
        {
          id: "elastic",
          provider: "elastic",
          enabled: true,
          kind: "remote",
          url: "https://kibana.example.invalid/api/agent_builder/mcp",
          authMode: "env_header",
          envHttpHeaders: { Authorization: "TESTDOCS_ELASTIC_AUTH_HEADER" }
        }
      ]
    },
    tms: { category: "none", provider: "none" },
    qaReport: { enabled: false }
  }), "utf8");
  const remoteResult = spawnSync(process.execPath, [
    path.join(scriptsDir, "install.mjs"),
    "--clients", "codex,opencode,generic",
    "--answers", answersFile,
    "--skip-dependencies",
    "--no-cli",
    "--opencode-format", "v2"
  ], { cwd: repoRoot, env, encoding: "utf8" });
  if (remoteResult.status !== 0) {
    process.stdout.write(remoteResult.stdout || "");
    process.stderr.write(remoteResult.stderr || "");
    throw new Error("Не установлены официальные remote MCP.");
  }
  const remoteCodex = fs.readFileSync(codexConfig, "utf8");
  const remoteOpenCode = JSON.parse(fs.readFileSync(openCodeConfig, "utf8"));
  const remoteGeneric = JSON.parse(fs.readFileSync(genericConfig, "utf8"));
  for (const name of ["testdocs_figma", "testdocs_gitlab", "testdocs_postman", "testdocs_elastic"]) {
    assert(remoteCodex.includes(`[mcp_servers.${name}]`), `Codex не получил ${name}.`);
    assert(remoteOpenCode.mcp.servers[name]?.type === "remote", `OpenCode не получил remote ${name}.`);
    assert(remoteGeneric.mcpServers[name]?.url, `Generic snippet не получил ${name}.`);
  }
  assert(remoteCodex.includes('default_tools_approval_mode = "writes"'), "Remote MCP не защищены approval mode для записей.");
  assert(remoteCodex.includes('Authorization = "TESTDOCS_ELASTIC_AUTH_HEADER"'), "Codex не получил безопасную env-ссылку Elastic auth.");
  assert(!remoteCodex.includes("ApiKey "), "В Codex config попал Elastic API key.");
  assert(remoteOpenCode.mcp.servers.testdocs_elastic.headers.Authorization === "{env:TESTDOCS_ELASTIC_AUTH_HEADER}", "OpenCode не получил env-подстановку Elastic auth.");

  assert(defaultFigmaMode({}, ["opencode"]) === "browser", "OpenCode must default to free browser access.");
  assert(defaultFigmaMode({ url: "https://mcp.figma.com/mcp" }, ["opencode"]) === "browser", "Legacy implicit remote must offer browser for OpenCode.");
  assert(defaultFigmaMode({ mode: "remote" }, ["opencode"]) === "remote", "Explicit choice must be preserved.");
  assert(!isFigmaDesktop({ provider: "gitlab", url: "http://127.0.0.1:3845/mcp", authMode: "none" }), "No-auth exception must be scoped to Figma.");
  assert(!isFigmaDesktop({ provider: "figma", url: "https://example.invalid/mcp", authMode: "none" }), "No-auth exception must be scoped to loopback endpoint.");
  for (const format of ["stable", "v2"]) {
    // Seed each format explicitly: unrelated servers must not be migrated implicitly.
    const fixture = JSON.parse(fs.readFileSync(openCodeConfig, "utf8"));
    const fixtureServers = fixture.mcp.servers || fixture.mcp;
    fixture.mcp = format === "v2" ? { servers: fixtureServers } : fixtureServers;
    fs.writeFileSync(openCodeConfig, JSON.stringify(fixture));
    for (const mode of ["browser", "browser", "desktop", "remote", "off"]) {
      const result = spawnSync(process.execPath, [
        path.join(scriptsDir, "install.mjs"), "--clients", "opencode,generic",
        "--configure", "figma", "--figma-mode", mode,
        "--skip-dependencies", "--no-cli", "--opencode-format", format
      ], { cwd: repoRoot, env, encoding: "utf8", timeout: 30000 });
      assert(result.status === 0, result.stdout + result.stderr);
      const installed = JSON.parse(fs.readFileSync(openCodeConfig, "utf8"));
      const servers = format === "v2" ? installed.mcp.servers : installed.mcp;
      assert(JSON.stringify(servers.existing_server) === JSON.stringify(fixtureServers.existing_server), "Figma-only setup changed an unrelated MCP server.");
      assert(servers.testdocs_gitlab.url === "https://gitlab.example.invalid/api/v4/mcp", "Figma-only setup changed GitLab.");
      assert(servers.testdocs_postman, "Figma-only setup removed Postman.");
      assert(servers.testdocs_elastic, "Figma-only setup removed Elastic.");
      const saved = JSON.parse(fs.readFileSync(privateConfig, "utf8"));
      const figmaItems = saved.connections.mcp.filter(item => item.provider === "figma");
      assert(figmaItems.length === (["browser", "off"].includes(mode) ? 0 : 1), "Duplicate or stale Figma connection.");
      if (mode === "browser") {
        assert(!servers.testdocs_figma, "Browser mode must not register official Figma MCP.");
        assert(servers.testdocs_browser, "Browser mode must register browser MCP.");
        assert(saved.browser.enabled && saved.figma.mode === "browser", "Browser settings not persisted.");
        assert(!result.stdout.includes("Авторизация remote MCP testdocs_figma"), "Browser mode attempted Figma OAuth.");
      } else if (mode === "off") assert(!servers.testdocs_figma, "Disabled Figma remains registered.");
      else if (mode === "desktop") {
        assert(servers.testdocs_figma.url === "http://127.0.0.1:3845/mcp", "Wrong Desktop endpoint.");
        assert(servers.testdocs_figma.oauth === false, "Desktop must disable OAuth.");
        assert(figmaItems[0].authMode === "none", "Desktop auth mode not persisted.");
      } else {
        assert(servers.testdocs_figma.url === "https://mcp.figma.com/mcp", "Wrong Remote endpoint.");
        assert(servers.testdocs_figma.oauth !== false, "Desktop OAuth override leaked into Remote.");
      }
    }
  }
  console.log("Figma browser/Desktop/Remote/off, OpenCode defaults and independent reconfiguration: OK");

  console.log("Изолированная установка Codex/Claude Code/OpenCode/generic: OK");
  console.log("Повторная установка без дублирования: OK");
  console.log("OpenCode stable, миграция ошибочного конфига и V2: OK");
  console.log("Секреты отсутствуют в клиентских MCP-конфигах: OK");
  console.log("Режим browser-session без пароля: OK");
  console.log("Независимая QA Report integration без Jira/Confluence: OK");
  console.log("Выбор QA Tools, login/password и защищённый MCP proxy: OK");
  console.log("Несколько Jira, единая Eva и повторное применение настроек: OK");
  console.log("Узкий opt-in Test Run только для выбранной Zephyr Jira: OK");
  console.log("Явное включение защищённых Jira write-инструментов при обновлении: OK");
  console.log("Figma, GitLab, Postman и Elastic remote MCP без секретов в клиентских конфигах: OK");
} finally {
  fs.rmSync(testRoot, { recursive: true, force: true });
}
