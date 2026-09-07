#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { getDataDir } from "./paths.mjs";

function fail(message) {
  console.error(message);
  process.exit(1);
}

function parseArgs(argv) {
  const result = { command: argv[0], project: "", task: "", json: false };
  for (let index = 1; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--project") result.project = argv[++index] || "";
    else if (arg === "--task") result.task = argv[++index] || "";
    else if (arg === "--json") result.json = true;
    else fail(`Неизвестный аргумент: ${arg}`);
  }
  return result;
}

function safeSegment(value, label) {
  const source = String(value || "").trim().normalize("NFKC");
  if (!source) fail(`Укажите ${label}.`);
  const readable = source
    .toLowerCase()
    .replace(/[^\p{L}\p{N}._-]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 72);
  const suffix = crypto.createHash("sha256").update(source).digest("hex").slice(0, 8);
  return `${readable || label}-${suffix}`;
}

function workspacePath(project, task) {
  return path.join(
    getDataDir(),
    "projects",
    safeSegment(project, "project"),
    "tasks",
    safeSegment(task, "task")
  );
}

function show(value, json) {
  process.stdout.write(json ? `${JSON.stringify(value, null, 2)}\n` : `${value.path}\n`);
}

const args = parseArgs(process.argv.slice(2));

if (!args.command || !["init", "path", "list"].includes(args.command)) {
  fail("Использование: task-workspace.mjs init|path|list --project <project> [--task <task>] [--json]");
}

if (args.command === "list") {
  if (!args.project) fail("Для list укажите --project.");
  const tasksRoot = path.join(getDataDir(), "projects", safeSegment(args.project, "project"), "tasks");
  const tasks = fs.existsSync(tasksRoot)
    ? fs.readdirSync(tasksRoot, { withFileTypes: true }).filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort()
    : [];
  show({ path: tasksRoot, tasks }, args.json);
  process.exit(0);
}

if (!args.project || !args.task) fail("Для init/path укажите --project и --task.");
const target = workspacePath(args.project, args.task);

if (args.command === "path") {
  if (!fs.existsSync(target)) fail(`Workspace задачи не найден: ${target}`);
  show({ path: target }, args.json);
  process.exit(0);
}

fs.mkdirSync(target, { recursive: true, mode: 0o700 });
for (const directory of ["reports", "evidence", "attachments", "requests"]) {
  fs.mkdirSync(path.join(target, directory), { recursive: true, mode: 0o700 });
}

const metadataFile = path.join(target, "workspace.json");
let metadata = {};
if (fs.existsSync(metadataFile)) {
  try { metadata = JSON.parse(fs.readFileSync(metadataFile, "utf8")); } catch { fail(`Повреждён ${metadataFile}`); }
}
const now = new Date().toISOString();
metadata = {
  version: 1,
  project: args.project.trim(),
  task: args.task.trim(),
  createdAt: metadata.createdAt || now,
  updatedAt: now
};
fs.writeFileSync(metadataFile, `${JSON.stringify(metadata, null, 2)}\n`, { mode: 0o600 });
try { fs.chmodSync(metadataFile, 0o600); } catch { /* Windows ACL управляется системой. */ }
show({ path: target, ...metadata }, args.json);
