#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const files = [path.join(repoRoot, "examples", "workflows", "task-checklist-only.md")];
const executionHeader = "||Номер||Проверка||Как проверить||Ожидаемый результат||Фактический результат||Комментарий||Статус||";
const questionHeader = "||Номер||Вопрос||Текущее наблюдение||Статус||";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function cells(row) {
  const result = [];
  let current = "";
  for (let index = 1; index < row.length - 1; index += 1) {
    const char = row[index];
    if (char === "|" && row[index - 1] !== "\\") {
      result.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  result.push(current);
  return result;
}

for (const file of files) {
  const lines = fs.readFileSync(file, "utf8").split(/\r?\n/);
  let mode = null;
  let bodyRows = 0;
  for (const [offset, line] of lines.entries()) {
    if (line === executionHeader) {
      mode = "execution";
      continue;
    }
    if (line === questionHeader) {
      mode = "questions";
      continue;
    }
    if (!line.startsWith("|") || line.startsWith("||")) continue;
    assert(mode, `${file}:${offset + 1}: строка таблицы без поддержанного header.`);
    assert(!line.includes("||"), `${file}:${offset + 1}: body row содержит ||.`);
    const rowCells = cells(line);
    const expectedCount = mode === "execution" ? 7 : 4;
    assert(rowCells.length === expectedCount, `${file}:${offset + 1}: ожидалось ${expectedCount} колонок, получено ${rowCells.length}.`);
    if (mode === "execution") {
      assert(rowCells.slice(4).every((value) => value.trim() === ""), `${file}:${offset + 1}: execution-колонки должны быть пустыми.`);
    }
    bodyRows += 1;
  }
  assert(lines.includes(executionHeader), `${file}: отсутствует header исполнимой таблицы.`);
  assert(bodyRows > 0, `${file}: нет строк checklist.`);
}

console.log(`Jira Wiki checklist format: OK (${files.length} fixture)`);
