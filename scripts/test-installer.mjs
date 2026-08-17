#!/usr/bin/env node

import fs from "node:fs";
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
  }

  const privateConfig = path.join(testRoot, "private-config", "config.json");
  const codexConfig = path.join(testRoot, "codex", "config.toml");
  const openCodeConfig = path.join(testRoot, ".config", "opencode", "opencode.json");
  const genericConfig = path.join(testRoot, "private-config", "client-snippets", "generic-mcp.json");

  for (const file of [privateConfig, codexConfig, openCodeConfig, genericConfig]) {
    assert(fs.existsSync(file), `Не создан ${file}`);
  }
  const savedPrivateConfig = JSON.parse(fs.readFileSync(privateConfig, "utf8"));
  assert(savedPrivateConfig.caFile?.endsWith("globalsign-gcc-r3-dv-tls-ca-2020.pem"), "Не сохранён CA-файл.");
  assert(savedPrivateConfig.enableTestCaseCreation === true, "Не включены создание и защищённое исправление кейса Zephyr.");
  assert(fs.existsSync(path.join(testRoot, ".agents", "skills", "generate-test-cases", "SKILL.md")), "Не установлены Agent Skills.");
  assert(fs.existsSync(path.join(testRoot, ".claude", "skills", "generate-test-cases", "SKILL.md")), "Не установлены Claude Skills.");

  const publicConfigs = [codexConfig, openCodeConfig, genericConfig].map((file) => fs.readFileSync(file, "utf8")).join("\n");
  assert(!publicConfigs.includes("dummy-jira-password"), "Секрет Jira попал в клиентскую конфигурацию.");
  assert(!publicConfigs.includes("dummy-confluence-password"), "Секрет Confluence попал в клиентскую конфигурацию.");
  assert(
    fs.readFileSync(codexConfig, "utf8").split("# BEGIN testdocs-kit").length - 1 === 1,
    "Повторный запуск продублировал Codex-конфигурацию."
  );

  const openCode = JSON.parse(fs.readFileSync(openCodeConfig, "utf8"));
  assert(openCode.mcp?.testdocs_jira, "Не добавлен OpenCode stable Jira MCP.");
  assert(openCode.mcp?.testdocs_confluence, "Не добавлен OpenCode stable Confluence MCP.");
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
  assert(browserPrivateConfig.jira.authMode === "browser_session", "Не сохранён browser_session для Jira.");
  assert(browserPrivateConfig.confluence.authMode === "browser_session", "Не сохранён browser_session для Confluence.");

  console.log("Изолированная установка Codex/Claude Code/OpenCode/generic: OK");
  console.log("Повторная установка без дублирования: OK");
  console.log("OpenCode stable, миграция ошибочного конфига и V2: OK");
  console.log("Секреты отсутствуют в клиентских MCP-конфигах: OK");
  console.log("Режим browser-session без пароля: OK");
} finally {
  fs.rmSync(testRoot, { recursive: true, force: true });
}
