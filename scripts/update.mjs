#!/usr/bin/env node

import path from "node:path";
import process from "node:process";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const scriptsDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptsDir, "..");

function run(command, args, options = {}) {
  const result = spawnSync(command, args, { cwd: repoRoot, stdio: "inherit", ...options });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} завершился с кодом ${result.status}`);
}

try {
  console.log("Обновляю Testdocs Kit без изменения сохранённых подключений...");
  run("git", ["pull", "--ff-only"]);
  run(process.execPath, [path.join(scriptsDir, "install.mjs"), "--reuse", "--skip-browser-auth"]);
  console.log("Обновление завершено. Перезапустите AI-клиент.");
} catch (error) {
  console.error(`Ошибка обновления: ${error.message}`);
  process.exit(1);
}
