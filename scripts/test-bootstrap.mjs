#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const script = path.join(repoRoot, "setup-macos.sh");

function run(args) {
  return spawnSync("/bin/bash", args, {
    cwd: repoRoot,
    encoding: "utf8",
    env: { ...process.env }
  });
}

const syntax = run(["-n", script]);
if (syntax.status !== 0) {
  throw new Error(`Ошибка синтаксиса setup-macos.sh: ${syntax.stderr}`);
}

const help = run([script, "--help"]);
if (help.status !== 0 || !help.stdout.includes("setup-macos.sh")) {
  throw new Error(`Не работает справка setup-macos.sh: ${help.stderr || help.stdout}`);
}

if (process.platform === "darwin") {
  const check = run([script, "--check"]);
  if (check.status !== 0 || !check.stdout.includes("Проверка bootstrap: OK")) {
    throw new Error(`Не пройдена проверка bootstrap: ${check.stderr || check.stdout}`);
  }
}

console.log("Проверка macOS bootstrap: OK");
