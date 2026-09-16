#!/usr/bin/env node

import path from "node:path";
import process from "node:process";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const scriptsDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptsDir, "..");

function parseArgs(argv) {
  const supported = new Set(["--enable-test-case-writes", "--enable-jira-writes", "--enable-release-test-run-writes", "--insecure-atlassian-tls", "--verify-atlassian-tls"]);
  for (const arg of argv) {
    if (!supported.has(arg)) throw new Error(`Неизвестный аргумент: ${arg}`);
  }
  if (argv.includes("--insecure-atlassian-tls") && argv.includes("--verify-atlassian-tls")) {
    throw new Error("Выберите только один TLS-флаг: --insecure-atlassian-tls или --verify-atlassian-tls.");
  }
  return {
    enableTestCaseWrites: argv.includes("--enable-test-case-writes"),
    enableJiraWrites: argv.includes("--enable-jira-writes"),
    enableReleaseTestRunWrites: argv.includes("--enable-release-test-run-writes"),
    tlsFlag: argv.find((arg) => ["--insecure-atlassian-tls", "--verify-atlassian-tls"].includes(arg))
  };
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, { cwd: repoRoot, stdio: "inherit", ...options });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} завершился с кодом ${result.status}`);
}

try {
  const args = parseArgs(process.argv.slice(2));
  console.log("Обновляю Testdocs Kit с сохранёнными подключениями...");
  run("git", ["pull", "--ff-only"]);
  const installArgs = [path.join(scriptsDir, "install.mjs"), "--reuse", "--skip-browser-auth"];
  if (args.enableTestCaseWrites) installArgs.push("--enable-test-case-writes");
  if (args.enableJiraWrites) installArgs.push("--enable-jira-writes");
  if (args.enableReleaseTestRunWrites) installArgs.push("--enable-release-test-run-writes");
  if (args.tlsFlag) installArgs.push(args.tlsFlag);
  run(process.execPath, installArgs);
  console.log("Обновление завершено. Перезапустите AI-клиент.");
} catch (error) {
  console.error(`Ошибка обновления: ${error.message}`);
  process.exit(1);
}
