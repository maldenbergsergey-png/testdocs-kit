#!/usr/bin/env node

import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const defaultFiles = [
  'examples/good/minimal-test-case.md',
  'examples/good/reusable-regression-test-case.md',
  'examples/good/reusable-regression-test-case-ru.md',
  'examples/good/shared-admin-setup-and-consumer-ru.md',
];

const files = process.argv.slice(2);
const targets = files.length > 0 ? files : defaultFiles;
const requiredFields = [
  '**Название:**',
  '**Цель:**',
  '**Предусловия:**',
  '**Тестовые данные:**',
  '**Путь:**',
  '| № | Шаг | Ожидаемый результат |',
  '**Постусловия:**',
  '**Теги:**',
  '**Статус:**',
  '**Приоритет:**',
];
const forbiddenLabels = [
  '**Name:**',
  '**Title:**',
  '**Objective:**',
  '**Description:**',
  '**Preconditions:**',
  '**Test data:**',
  '**Steps:**',
  '**Expected result:**',
  '**Proposed status:**',
  '**Lifecycle status:**',
  '| Step | Action | Expected result |',
  '| № | Действие | Ожидаемый результат |',
];

let caseCount = 0;
const errors = [];

for (const file of targets) {
  const absolutePath = resolve(file);
  const content = await readFile(absolutePath, 'utf8');

  for (const label of forbiddenLabels) {
    if (content.includes(label)) {
      errors.push(`${file}: запрещённый или устаревший заголовок ${label}`);
    }
  }

  const starts = [...content.matchAll(/^\*\*Название:\*\*/gm)].map((match) => match.index);
  starts.forEach((start, index) => {
    const end = starts[index + 1] ?? content.length;
    const candidate = content.slice(start, end);

    // A reusable setup also has «Название», but only a test case has «Цель».
    if (!candidate.includes('**Цель:**')) return;

    caseCount += 1;
    let previous = -1;
    for (const field of requiredFields) {
      const position = candidate.indexOf(field);
      if (position === -1) {
        errors.push(`${file}: тест-кейс ${caseCount} не содержит ${field}`);
        continue;
      }
      if (position <= previous) {
        errors.push(`${file}: тест-кейс ${caseCount} нарушает порядок у поля ${field}`);
      }
      previous = position;
    }

    const tableStart = candidate.indexOf('| № | Шаг | Ожидаемый результат |');
    if (tableStart === -1) return;

    const tableLines = candidate
      .slice(tableStart)
      .split('\n')
      .filter((line) => line.trim().startsWith('|'));

    for (const line of tableLines.slice(2)) {
      const cells = line.split('|').slice(1, -1).map((cell) => cell.trim());
      if (cells.length !== 3 || cells.some((cell) => cell.length === 0)) {
        errors.push(`${file}: строка шага должна содержать три заполненные колонки: ${line}`);
        continue;
      }
      if (cells[1].includes('→')) {
        errors.push(`${file}: действие и результат нельзя соединять стрелкой: ${line}`);
      }
    }
  });
}

if (caseCount === 0) {
  errors.push('Не найдено ни одного тест-кейса для проверки.');
}

if (errors.length > 0) {
  console.error('Проверка формата тест-кейсов: ошибка');
  for (const error of errors) console.error(`- ${error}`);
  process.exitCode = 1;
} else {
  console.log(`Проверка формата тест-кейсов: OK (${caseCount})`);
}
