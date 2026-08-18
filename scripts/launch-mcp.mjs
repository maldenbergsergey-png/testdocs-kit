#!/usr/bin/env node

import fs from "node:fs";
import { spawn } from "node:child_process";
import { getConfigFile, getSessionFile, serviceEntries } from "./paths.mjs";

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
  if (config.caFile && !fs.existsSync(config.caFile)) {
    fail(`не найден дополнительный CA-файл ${config.caFile}. Повторите npm run setup.`);
  }
  const common = {
    ...process.env,
    TESTDOCS_ENABLE_WRITES: config.enableWrites ? "1" : "0",
    TESTDOCS_ENABLE_TEST_CASE_CREATION: config.enableTestCaseCreation === false ? "0" : "1",
    TESTDOCS_ENABLE_CHECKLIST_COMMENT_PUBLICATION:
      config.enableChecklistCommentPublication === true ? "1" : "0",
    TESTDOCS_ENABLE_QA_REPORT_IMPORT: config.enableQaReportImport === true ? "1" : "0",
    ...(config.caFile ? { NODE_EXTRA_CA_CERTS: config.caFile } : {})
  };

  if (service === "jira") {
    const jira = config.jira;
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
      JIRA_SESSION_FILE: getSessionFile("jira"),
      JIRA_API_VERSION: String(jira.apiVersion || "2"),
      JIRA_INSECURE_TLS: jira.insecureTls ? "1" : "0",
      JIRA_TEST_CASE_URL_TEMPLATE:
        jira.testCaseUrlTemplate || `${jira.url}/secure/Tests.jspa#/testCase/{key}`,
      TESTDOCS_TMS_PROVIDER: config.tms?.provider || "zephyr_scale"
    };
  }

  if (service === "qa_tools") {
    const qaTools = config.qaTools;
    if (config.tms?.provider !== "qa_tools" || !qaTools?.enabled) {
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

  const confluence = config.confluence;
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
    CONFLUENCE_SESSION_FILE: getSessionFile("confluence"),
    CONFLUENCE_INSECURE_TLS: confluence.insecureTls ? "1" : "0"
  };
}

const service = process.argv[2];
if (!Object.hasOwn(serviceEntries, service)) {
  fail("укажите сервис jira, confluence, qa_tools или delivery.");
}

const config = readConfig();
const child = spawn(process.execPath, [serviceEntries[service]], {
  cwd: new URL(`../mcp/${service === "confluence" ? "confluence-mcp" : service === "qa_tools" ? "qa-tools-mcp" : "jira-mcp"}/`, import.meta.url),
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
