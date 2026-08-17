#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { createRequire } from "node:module";
import { getConfigFile, launcherFile, repoRoot } from "./paths.mjs";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function validatePrivateConfig() {
  const configFile = getConfigFile();
  assert(fs.existsSync(configFile), `Не найден ${configFile}. Выполните npm run setup.`);
  const config = JSON.parse(fs.readFileSync(configFile, "utf8"));
  assert(config.version === 1, "Неподдерживаемая версия файла настроек.");
  if (config.caFile) {
    assert(fs.existsSync(config.caFile), `Не найден дополнительный CA-файл: ${config.caFile}`);
  }

  if (config.jira?.enabled) {
    assert(config.jira.url && config.jira.authMode, "Неполные настройки Jira.");
    if (config.jira.authMode !== "browser_session") {
      assert(config.jira.secret, "Не заполнены учётные данные Jira.");
    }
  }
  if (config.confluence?.enabled) {
    assert(config.confluence.baseUrl && config.confluence.authMode, "Неполные настройки Confluence.");
    if (config.confluence.authMode !== "browser_session") {
      assert(config.confluence.secret, "Не заполнены учётные данные Confluence.");
    }
  }
  return config;
}

async function loadMcpClient(config) {
  const packageFile = config.jira?.enabled
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

async function listTools(service, Client, StdioClientTransport) {
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [launcherFile, service],
    env: { ...process.env }
  });
  const client = new Client({ name: "testdocs-kit-check", version: "1.0.0" });
  await client.connect(transport);
  const result = await client.listTools();
  await client.close();
  return result.tools.map((tool) => tool.name);
}

async function main() {
  const config = validatePrivateConfig();
  if (!config.jira?.enabled && !config.confluence?.enabled) {
    console.log("MCP-сервисы отключены; проверен только файл настроек.");
    console.log("Проверка установки: OK");
    return;
  }
  const { Client, StdioClientTransport } = await loadMcpClient(config);
  const results = [];

  if (config.jira?.enabled) {
    const tools = await listTools("jira", Client, StdioClientTransport);
    assert(tools.includes("get_issue"), "Jira MCP не отдал get_issue.");
    if (config.enableTestCaseCreation !== false) {
      assert(tools.includes("zephyr_create_test_case"), "Jira MCP не отдал create-only инструмент Zephyr.");
    }
    assert(!tools.includes("add_comment"), "Write-инструмент add_comment включён без разрешения.");
    assert(!tools.includes("transition_issue"), "Write-инструмент transition_issue включён без разрешения.");
    results.push(`Jira MCP: ${tools.length} инструментов (чтение + создание кейса по явному запросу)`);
  }

  if (config.confluence?.enabled) {
    const tools = await listTools("confluence", Client, StdioClientTransport);
    assert(tools.includes("get_page"), "Confluence MCP не отдал get_page.");
    results.push(`Confluence MCP: ${tools.length} read-only инструментов`);
  }

  console.log(results.join("\n") || "MCP-сервисы отключены; проверен только файл настроек.");
  console.log("Проверка установки: OK");
}

main().catch((error) => {
  console.error(`Проверка установки не пройдена: ${error.message}`);
  process.exit(1);
});
