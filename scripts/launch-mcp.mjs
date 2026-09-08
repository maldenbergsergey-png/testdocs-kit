#!/usr/bin/env node

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { getConfigFile, getSessionFile, getDataDir, serviceEntries, repoRoot } from "./paths.mjs";
import { connectionList, findConnection, hasQaTools, migrateConfig, sessionKey, usesZephyr } from "./config-model.mjs";

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
    return migrateConfig(JSON.parse(fs.readFileSync(configFile, "utf8")));
  } catch (error) {
    fail(`не удалось прочитать ${configFile}: ${error.message}`);
  }
}

function buildEnvironment(service, connectionId, config) {
  if (config.caFile && !fs.existsSync(config.caFile)) {
    fail(`не найден дополнительный CA-файл ${config.caFile}. Повторите npm run setup.`);
  }
  const common = {
    ...process.env,
    TESTDOCS_ENABLE_WRITES: config.enableWrites ? "1" : "0",
    TESTDOCS_ENABLE_TEST_CASE_CREATION: config.enableTestCaseCreation === false ? "0" : "1",
    TESTDOCS_ENABLE_CHECKLIST_COMMENT_PUBLICATION:
      config.enableChecklistCommentPublication === true ? "1" : "0",
    TESTDOCS_ENABLE_BUG_CREATION: config.enableBugCreation === true ? "1" : "0",
    TESTDOCS_ENABLE_QA_REPORT_IMPORT: config.enableQaReportImport === true ? "1" : "0",
    ...(config.caFile ? { NODE_EXTRA_CA_CERTS: config.caFile } : {})
  };

  if (service === "browser") {
    if (!config.browser?.enabled) fail("браузер выключен; выполните npm run configure:browser.");
    return common;
  }

  if (service === "jira") {
    const jira = findConnection(config, "jira", connectionId);
    if (!jira?.enabled) fail("подключение Jira выключено в настройках.");
    if (!jira.url || !jira.authMode) fail("для Jira не заполнены адрес или режим авторизации.");
    if (jira.authMode !== "browser_session" && !jira.secret) {
      fail("для Jira не заполнены учётные данные.");
    }

    return {
      ...common,
      JIRA_URL: jira.url,
      JIRA_EMAIL: jira.username || "",
      JIRA_TOKEN: jira.secret || "",
      JIRA_AUTH_MODE: jira.authMode || "basic",
      JIRA_SESSION_FILE: getSessionFile(sessionKey("jira", jira.id, connectionList(config, "jira").length)),
      JIRA_API_VERSION: String(jira.apiVersion || "2"),
      JIRA_INSECURE_TLS: jira.insecureTls ? "1" : "0",
      JIRA_TEST_CASE_URL_TEMPLATE:
        jira.testCaseUrlTemplate || `${jira.url}/secure/Tests.jspa#/testCase/{key}`,
      JIRA_TEST_RUN_URL_TEMPLATE:
        jira.testRunUrlTemplate || `${jira.url}/secure/Tests.jspa#/testCycle/{key}`,
      TESTDOCS_TMS_PROVIDER: usesZephyr(config, jira.id) ? "zephyr_scale" : "none",
      TESTDOCS_ENABLE_CHECKLIST_COMMENT_PUBLICATION:
        jira.enableChecklistCommentPublication === true ? "1" : "0",
      TESTDOCS_ENABLE_BUG_CREATION: jira.enableBugCreation === true ? "1" : "0",
      TESTDOCS_ENABLE_RELEASE_TEST_RUN_CREATION:
        jira.enableReleaseTestRunCreation === true ? "1" : "0"
    };
  }

  if (service === "qa_tools") {
    const qaTools = config.qaTools;
    if (!hasQaTools(config)) {
      fail("QA Tools (ТестОпс) не выбран как TMS.");
    }
    if (!qaTools.baseUrl || !qaTools.authMode || !qaTools.secret) {
      fail("для QA Tools не заполнены адрес или учётные данные.");
    }
    return {
      ...common,
      QA_TOOLS_URL: qaTools.baseUrl,
      QA_TOOLS_AUTH_MODE: qaTools.authMode,
      QA_TOOLS_USERNAME: qaTools.username || "",
      QA_TOOLS_TOKEN: qaTools.secret,
      QA_TOOLS_INSECURE_TLS: qaTools.insecureTls ? "1" : "0",
      TESTDOCS_ENABLE_QA_TOOLS_WRITES: config.enableQaToolsWrites === true ? "1" : "0"
    };
  }

  if (service === "eva") {
    const eva = findConnection(config, "eva", connectionId);
    if (!eva?.enabled) fail("подключение Eva выключено в настройках.");
    if (!eva.baseUrl || !eva.secret) fail("для Eva не заполнены адрес или API-токен.");
    return {
      ...common,
      EVA_API_URL: eva.baseUrl,
      EVA_API_TOKEN: eva.secret
    };
  }

  if (service === "delivery") {
    if (!config.qaReport?.enabled || !config.qaReport.baseUrl) {
      fail("подключение QA Report выключено или не настроено.");
    }
    return {
      ...common,
      TESTDOCS_DELIVERY_ONLY: "1",
      QA_REPORT_URL: config.qaReport.baseUrl
    };
  }

  const confluence = findConnection(config, "confluence", connectionId);
  if (!confluence?.enabled) fail("подключение Confluence выключено в настройках.");
  if (!confluence.baseUrl || !confluence.authMode) {
    fail("для Confluence не заполнены адрес или режим авторизации.");
  }
  if (confluence.authMode !== "browser_session" && !confluence.secret) {
    fail("для Confluence не заполнены учётные данные.");
  }

  return {
    ...common,
    CONFLUENCE_BASE_URL: confluence.baseUrl,
    CONFLUENCE_USERNAME: confluence.username || "",
    CONFLUENCE_API_TOKEN: confluence.secret || "",
    CONFLUENCE_AUTH_MODE: confluence.authMode || "basic",
    CONFLUENCE_SESSION_FILE: getSessionFile(sessionKey("confluence", confluence.id, connectionList(config, "confluence").length)),
    CONFLUENCE_INSECURE_TLS: confluence.insecureTls ? "1" : "0"
  };
}

const service = process.argv[2];
const connectionId = process.argv[3];
if (!Object.hasOwn(serviceEntries, service)) {
  fail("укажите сервис jira, confluence, eva, qa_tools, browser или delivery.");
}

const config = readConfig();
const serviceArgs = [serviceEntries[service]];
if (service === "browser") {
  if (!config.browser?.enabled) fail("браузер выключен; выполните npm run configure:browser.");
  if (!["persistent", "extension"].includes(config.browser.mode)) fail("неизвестный режим browser.");
  if (!fs.existsSync(serviceEntries.browser)) fail("Playwright MCP не установлен; выполните npm run setup -- --reuse.");
  const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), "testdocs-browser-"));
  serviceArgs.push("--output-dir", outputDir);
  if (config.figma?.mode === "browser") serviceArgs.push("--caps", "vision");
  if (config.browser.mode === "extension") serviceArgs.push("--extension");
  else {
    const profileDir = path.join(getDataDir(), "browser", "profile");
    fs.mkdirSync(profileDir, { recursive: true, mode: 0o700 });
    serviceArgs.push("--browser", "chrome", "--user-data-dir", profileDir);
  }
}
const child = spawn(process.execPath, serviceArgs, {
  cwd: service === "browser" ? repoRoot : new URL(`../mcp/${service === "confluence" ? "confluence-mcp" : ["qa_tools", "eva"].includes(service) ? "qa-tools-mcp" : "jira-mcp"}/`, import.meta.url),
  env: buildEnvironment(service, connectionId, config),
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
