#!/usr/bin/env node

import path from "node:path";
import process from "node:process";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const scriptsDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptsDir, "..");

function parseArgs(argv) {
  const supported = new Set(["--enable-jira-writes"]);
  for (const arg of argv) {
    if (!supported.has(arg)) throw new Error(`Неизвестный аргумент: ${arg}`);
  }
  return { enableJiraWrites: argv.includes("--enable-jira-writes") };
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, { cwd: repoRoot, stdio: "inherit", ...options });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} завершился с кодом ${result.status}`);
}

try {
  const args = parseArgs(process.argv.slice(2));
  console.log("Обновляю Testdocs Kit без изменения сохранённых подключений...");
  run("git", ["pull", "--ff-only"]);
  const installArgs = [path.join(scriptsDir, "install.mjs"), "--reuse", "--skip-browser-auth"];
  if (args.enableJiraWrites) installArgs.push("--enable-jira-writes");
  run(process.execPath, installArgs);
  console.log("Обновление завершено. Перезапустите AI-клиент.");
} catch (error) {
  console.error(`Ошибка обновления: ${error.message}`);
  process.exit(1);
}
