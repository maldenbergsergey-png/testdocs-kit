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
    TESTDOCS_INSTALL_ROOT: testRoot,
    TESTDOCS_CONFIG_DIR: path.join(testRoot, "private-config"),
    TESTDOCS_CODEX_CONFIG: path.join(testRoot, "codex", "config.toml"),
    TESTDOCS_OPENCODE_CONFIG: path.join(testRoot, "opencode", "opencode.json")
  };

  const installArgs = [
    path.join(scriptsDir, "install.mjs"),
    "--clients", "codex,claude,opencode,generic",
    "--answers", answersFile,
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
  }

  const privateConfig = path.join(testRoot, "private-config", "config.json");
  const codexConfig = path.join(testRoot, "codex", "config.toml");
  const openCodeConfig = path.join(testRoot, "opencode", "opencode.json");
  const genericConfig = path.join(testRoot, "private-config", "client-snippets", "generic-mcp.json");

  for (const file of [privateConfig, codexConfig, openCodeConfig, genericConfig]) {
    assert(fs.existsSync(file), `Не создан ${file}`);
  }
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
  assert(openCode.mcp?.servers?.testdocs_jira, "Не добавлен OpenCode V2 Jira MCP.");
  assert(openCode.mcp?.servers?.testdocs_confluence, "Не добавлен OpenCode V2 Confluence MCP.");

  fs.writeFileSync(openCodeConfig, JSON.stringify({
    $schema: "https://opencode.ai/config.json",
    mcp: {
      existing_server: { type: "local", command: ["node", "existing.js"], enabled: true }
    }
  }), "utf8");
  const legacyResult = spawnSync(process.execPath, [
    path.join(scriptsDir, "install.mjs"),
    "--clients", "opencode",
    "--answers", answersFile,
    "--skip-dependencies",
    "--no-cli"
  ], { cwd: repoRoot, env, encoding: "utf8" });
  assert(legacyResult.status === 0, "Не установлена legacy-конфигурация OpenCode.");
  const legacyOpenCode = JSON.parse(fs.readFileSync(openCodeConfig, "utf8"));
  assert(legacyOpenCode.mcp?.existing_server, "Потерян существующий legacy MCP-сервер.");
  assert(legacyOpenCode.mcp?.testdocs_jira, "Не добавлен legacy OpenCode Jira MCP.");
  assert(!legacyOpenCode.mcp?.servers, "Legacy-конфигурация ошибочно преобразована в V2.");

  console.log("Изолированная установка Codex/Claude Code/OpenCode/generic: OK");
  console.log("Повторная установка без дублирования: OK");
  console.log("Совместимость с legacy OpenCode: OK");
  console.log("Секреты отсутствуют в клиентских MCP-конфигах: OK");
} finally {
  fs.rmSync(testRoot, { recursive: true, force: true });
}
