#!/usr/bin/env node

import fs from "node:fs";
import { spawn } from "node:child_process";
import { getConfigFile, serviceEntries } from "./paths.mjs";

function fail(message) {
  process.stderr.write(`Testdocs Kit: ${message}\n`);
  process.exit(1);
}

function readConfig() {
  const configFile = getConfigFile();
  if (!fs.existsSync(configFile)) {
    fail(`не найден файл настроек ${configFile}. Выполните npm run setup.`);
  }

  try {
    return JSON.parse(fs.readFileSync(configFile, "utf8"));
  } catch (error) {
    fail(`не удалось прочитать ${configFile}: ${error.message}`);
  }
}

function buildEnvironment(service, config) {
  const common = {
    ...process.env,
    TESTDOCS_ENABLE_WRITES: config.enableWrites ? "1" : "0"
  };

  if (service === "jira") {
    const jira = config.jira;
    if (!jira?.enabled) fail("подключение Jira выключено в настройках.");
    if (!jira.url || !jira.secret) fail("для Jira не заполнены адрес или учётные данные.");

    return {
      ...common,
      JIRA_URL: jira.url,
      JIRA_EMAIL: jira.username || "",
      JIRA_TOKEN: jira.secret,
      JIRA_AUTH_MODE: jira.authMode || "basic",
      JIRA_API_VERSION: String(jira.apiVersion || "2"),
      JIRA_INSECURE_TLS: jira.insecureTls ? "1" : "0"
    };
  }

  const confluence = config.confluence;
  if (!confluence?.enabled) fail("подключение Confluence выключено в настройках.");
  if (!confluence.baseUrl || !confluence.secret) {
    fail("для Confluence не заполнены адрес или учётные данные.");
  }

  return {
    ...common,
    CONFLUENCE_BASE_URL: confluence.baseUrl,
    CONFLUENCE_USERNAME: confluence.username || "",
    CONFLUENCE_API_TOKEN: confluence.secret,
    CONFLUENCE_AUTH_MODE: confluence.authMode || "basic",
    CONFLUENCE_INSECURE_TLS: confluence.insecureTls ? "1" : "0"
  };
}

const service = process.argv[2];
if (!Object.hasOwn(serviceEntries, service)) {
  fail("укажите сервис jira или confluence.");
}

const config = readConfig();
const child = spawn(process.execPath, [serviceEntries[service]], {
  cwd: new URL(`../mcp/${service === "jira" ? "jira-mcp" : "confluence-mcp"}/`, import.meta.url),
  env: buildEnvironment(service, config),
  stdio: "inherit"
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => child.kill(signal));
}

child.on("error", (error) => fail(`не удалось запустить ${service}: ${error.message}`));
child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  process.exit(code ?? 1);
});
