#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { createRequire } from "node:module";
import { spawnSync } from "node:child_process";
import { getConfigFile, launcherFile, repoRoot } from "./paths.mjs";
import { connectionList, hasQaTools, migrateConfig, usesZephyr } from "./config-model.mjs";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function validatePrivateConfig() {
  const configFile = getConfigFile();
  assert(fs.existsSync(configFile), `Не найден ${configFile}. Выполните npm run setup.`);
  const config = migrateConfig(JSON.parse(fs.readFileSync(configFile, "utf8")));
  assert(config.version === 2, "Неподдерживаемая версия файла настроек.");
  if (config.caFile) {
    assert(fs.existsSync(config.caFile), `Не найден дополнительный CA-файл: ${config.caFile}`);
  }

  for (const jira of connectionList(config, "jira")) {
    assert(jira.url && jira.authMode, `Неполные настройки Jira ${jira.id}.`);
    if (jira.authMode !== "browser_session") {
      assert(jira.secret, `Не заполнены учётные данные Jira ${jira.id}.`);
    }
  }
  for (const confluence of connectionList(config, "confluence")) {
    assert(confluence.baseUrl && confluence.authMode, `Неполные настройки Confluence ${confluence.id}.`);
    if (confluence.authMode !== "browser_session") {
      assert(confluence.secret, `Не заполнены учётные данные Confluence ${confluence.id}.`);
    }
  }
  for (const eva of connectionList(config, "eva")) {
    assert(/^https?:\/\//.test(eva.baseUrl || ""), `Неполный адрес Eva ${eva.id}.`);
    assert(eva.secret && eva.command, `Не заполнены API-токен или MCP-команда Eva ${eva.id}.`);
  }
  if (config.qaReport?.enabled) {
    assert(/^https?:\/\//.test(config.qaReport.baseUrl || ""), "Неполные настройки QA Report.");
  }
  assert(["zephyr", "other", "none"].includes(config.tms?.category), "Неизвестная категория TMS.");
  if (hasQaTools(config)) {
    assert(config.qaTools?.enabled, "QA Tools выключен при выбранной TMS.");
    assert(/^https?:\/\//.test(config.qaTools.baseUrl || ""), "Неполный адрес QA Tools.");
    assert(["api_token", "password"].includes(config.qaTools.authMode), "Неизвестный режим авторизации QA Tools.");
    if (config.qaTools.authMode === "password") assert(config.qaTools.username, "Не заполнен логин QA Tools.");
    assert(config.qaTools.secret, "Не заполнены учётные данные QA Tools.");
  }
  return config;
}

async function loadMcpClient(config) {
  const packageFile = hasQaTools(config) || connectionList(config, "eva").length
    ? path.join(repoRoot, "mcp", "qa-tools-mcp", "package.json")
    : connectionList(config, "jira").length || (config.qaReport?.enabled && config.enableQaReportImport === true)
    ? path.join(repoRoot, "mcp", "jira-mcp", "package.json")
    : path.join(repoRoot, "mcp", "confluence-mcp", "package.json");
  const requireFromService = createRequire(packageFile);
  const clientPath = requireFromService.resolve("@modelcontextprotocol/sdk/client/index.js");
  const transportPath = requireFromService.resolve("@modelcontextprotocol/sdk/client/stdio.js");
  const [{ Client }, { StdioClientTransport }] = await Promise.all([
    import(pathToFileURL(clientPath).href),
    import(pathToFileURL(transportPath).href)
  ]);
  return { Client, StdioClientTransport };
}

async function listTools(service, connectionId, Client, StdioClientTransport) {
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [launcherFile, service, ...(connectionId ? [connectionId] : [])],
    env: { ...process.env }
  });
  const client = new Client({ name: "testdocs-kit-check", version: "1.0.0" });
  await client.connect(transport);
  const result = await client.listTools();
  await client.close();
  return result.tools.map((tool) => tool.name);
}

async function main() {
  const offlineExternal = process.argv.includes("--offline-external");
  const config = validatePrivateConfig();
  if (!connectionList(config, "jira").length && !connectionList(config, "confluence").length && !connectionList(config, "eva").length && !(config.qaReport?.enabled && config.enableQaReportImport === true) && !hasQaTools(config)) {
    console.log("MCP-сервисы отключены; проверен только файл настроек.");
    console.log("Проверка установки: OK");
    return;
  }
  const { Client, StdioClientTransport } = await loadMcpClient(config);
  const results = [];

  for (const jira of connectionList(config, "jira")) {
    const tools = await listTools("jira", jira.id, Client, StdioClientTransport);
    assert(tools.includes("get_issue"), "Jira MCP не отдал get_issue.");
    assert(tools.includes("jira_get_bug_create_metadata"), "Jira MCP не отдал read-only metadata создания бага.");
    if (jira.enableBugCreation === true) {
      assert(tools.includes("jira_create_bug"), "Jira MCP не отдал защищённый инструмент создания бага.");
    } else {
      assert(!tools.includes("jira_create_bug"), "Создание багов включено без разрешения.");
    }
    if (usesZephyr(config, jira.id) && config.enableTestCaseCreation !== false) {
      assert(tools.includes("zephyr_create_test_case"), "Jira MCP не отдал инструмент создания кейса Zephyr.");
      assert(tools.includes("zephyr_update_session_test_case"), "Jira MCP не отдал защищённый инструмент исправления кейса текущей сессии.");
      assert(tools.includes("zephyr_update_test_case"), "Jira MCP не отдал защищённый инструмент обновления существующего кейса.");
    }
    if (!usesZephyr(config, jira.id)) {
      assert(!tools.some((tool) => tool.startsWith("zephyr_")), "Jira MCP отдал Zephyr tools при выбранном QA Tools.");
    }
    assert(!tools.includes("add_comment"), "Write-инструмент add_comment включён без разрешения.");
    assert(!tools.includes("transition_issue"), "Write-инструмент transition_issue включён без разрешения.");
    if (jira.enableChecklistCommentPublication === true) {
      assert(tools.includes("jira_publish_checklist_comment"), "Jira MCP не отдал защищённую публикацию checklist-комментария.");
    } else {
      assert(!tools.includes("jira_publish_checklist_comment"), "Публикация checklist-комментария включена без разрешения.");
    }
    results.push(`Jira ${jira.id}: ${tools.length} инструментов`);
  }

  if (hasQaTools(config)) {
    const entry = path.join(repoRoot, "mcp", "qa-tools-mcp", "mcp-stdio.js");
    const syntax = spawnSync(process.execPath, ["--check", entry], { encoding: "utf8" });
    assert(syntax.status === 0, `Некорректный QA Tools MCP proxy: ${syntax.stderr}`);
    if (offlineExternal) {
      results.push("QA Tools MCP proxy: локальный код проверен; удалённый handshake пропущен в offline-режиме");
    } else {
      const tools = await listTools("qa_tools", null, Client, StdioClientTransport);
      assert(tools.includes("testops_find_testcases"), "QA Tools MCP не отдал инструмент чтения testops_find_testcases.");
      results.push(`QA Tools MCP: удалённое соединение и авторизация проверены, доступно ${tools.length} инструментов`);
    }
  }

  if (config.qaReport?.enabled && config.enableQaReportImport === true) {
    const tools = await listTools("delivery", null, Client, StdioClientTransport);
    assert(tools.includes("qa_report_import_checklist"), "Delivery MCP не отдал импорт checklist в QA Report.");
    results.push(`QA Report: ${tools.length} инструмент импорта по явному запросу`);
  }

  for (const confluence of connectionList(config, "confluence")) {
    const tools = await listTools("confluence", confluence.id, Client, StdioClientTransport);
    assert(tools.includes("get_page"), "Confluence MCP не отдал get_page.");
    results.push(`Confluence ${confluence.id}: ${tools.length} read-only инструментов`);
  }

  for (const eva of connectionList(config, "eva")) {
    const entry = path.join(repoRoot, "mcp", "qa-tools-mcp", "eva-mcp-stdio.js");
    const syntax = spawnSync(process.execPath, ["--check", entry], { encoding: "utf8" });
    assert(syntax.status === 0, `Некорректный Eva MCP proxy: ${syntax.stderr}`);
    if (offlineExternal) {
      results.push(`Eva ${eva.id}: локальная read-only policy проверена; внешний handshake пропущен`);
    } else {
      const tools = await listTools("eva", eva.id, Client, StdioClientTransport);
      assert(tools.includes("eva_task_get"), "Eva MCP не отдал eva_task_get.");
      assert(tools.includes("eva_document_get"), "Eva MCP не отдал eva_document_get.");
      assert(!tools.some((tool) => /create|update|delete|archive/.test(tool)), "Eva proxy открыл изменяющий tool.");
      results.push(`Eva ${eva.id}: ${tools.length} read-only инструментов`);
    }
  }

  console.log(results.join("\n") || "MCP-сервисы отключены; проверен только файл настроек.");
  console.log("Проверка установки: OK");
}

main().catch((error) => {
  console.error(`Проверка установки не пройдена: ${error.message}`);
  process.exit(1);
});
