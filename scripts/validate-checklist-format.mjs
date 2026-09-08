#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const files = [
  path.join(repoRoot, "examples", "workflows", "task-checklist-only.md"),
  path.join(repoRoot, "examples", "workflows", "task-compact-checklist.md")
];
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

export function validateChecklist(source, file = "checklist") {
  const lines = source.split(/\r?\n/);
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
    if (!line.startsWith("|")) {
      mode = null;
      continue;
    }
    assert(!line.startsWith("||"), `${file}:${offset + 1}: неподдержанный порядок или состав колонок header.`);
    assert(mode, `${file}:${offset + 1}: строка таблицы без поддержанного header.`);
    assert(line.endsWith("|"), `${file}:${offset + 1}: отсутствует конечный разделитель строки.`);
    assert(!line.includes("||"), `${file}:${offset + 1}: body row содержит ||.`);
    const rowCells = cells(line);
    const expectedCount = mode === "execution" ? 7 : 4;
    assert(rowCells.length === expectedCount, `${file}:${offset + 1}: ожидалось ${expectedCount} колонок, получено ${rowCells.length}.`);
    if (mode === "execution") {
      assert(rowCells.slice(0, 4).every((value) => value.trim() !== ""), `${file}:${offset + 1}: колонки 1–4, включая ожидаемый результат, должны быть заполнены.`);
      assert(rowCells[4].trim() === "", `${file}:${offset + 1}: Фактический результат (колонка 5) должен быть пустым в плане.`);
      assert(rowCells[6].trim() === "", `${file}:${offset + 1}: Статус (колонка 7) должен быть пустым в плане.`);
    }
    bodyRows += 1;
  }
  assert(lines.includes(executionHeader), `${file}: отсутствует header исполнимой таблицы.`);
  assert(bodyRows > 0, `${file}: нет строк checklist.`);
  if (file.endsWith("task-compact-checklist.md")) {
    assert(!source.includes(questionHeader), `${file}: компактный fixture не должен содержать искусственный раздел уточнений.`);
    assert((source.match(/^h2\. /gm) || []).length === 1, `${file}: компактный fixture должен содержать один смысловой раздел.`);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const targets = process.argv.length > 2 ? process.argv.slice(2) : files;
  for (const file of targets) validateChecklist(fs.readFileSync(file, "utf8"), file);
  console.log(`Jira Wiki checklist format: OK (${targets.length} files)`);
}
