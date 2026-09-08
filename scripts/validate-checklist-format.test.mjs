import { test } from "node:test";
import assert from "node:assert/strict";
import { validateChecklist } from "./validate-checklist-format.mjs";

const header = "||Номер||Проверка||Как проверить||Ожидаемый результат||Фактический результат||Комментарий||Статус||";
const check = (row) => validateChecklist(`${header}\n${row}`);

test("accepts empty execution cells and a source in column 6", () => {
  check("|1.|Закрытие окна|Нажать крестик|Окно закрыто| | | |");
  check("|1.|Закрытие окна|Нажать крестик|Окно закрыто| |Источник для сверки: checklist из комментария Jira 123| |");
});

test("rejects the screenshot failure: extra empty cell before expected result", () => {
  assert.throws(() => check("|1.|Закрытие окна|Нажать крестик| |Окно закрыто| |Источник для сверки: checklist из комментария Jira 123| |"), /ожидалось 7 колонок, получено 8/);
});

test("rejects shifted data even when the row still has seven cells", () => {
  assert.throws(() => check("|1.|Закрытие окна|Нажать крестик| |Окно закрыто| |Источник|"), /колонки 1–4/);
  assert.throws(() => check("|1.|Закрытие окна|Нажать крестик|Окно закрыто|Окно закрыто| | |"), /Фактический результат/);
  assert.throws(() => check("|1.|Закрытие окна|Нажать крестик|Окно закрыто| | |Источник|"), /Статус/);
});

test("rejects reordered headers and missing end delimiter", () => {
  assert.throws(() => validateChecklist(header.replace("Ожидаемый результат||Фактический результат", "Фактический результат||Ожидаемый результат")), /header/);
  assert.throws(() => check("|1.|Закрытие окна|Нажать крестик|Окно закрыто| | | "), /конечный разделитель/);
});

test("accepts escaped pipes and the separate four-column questions table", () => {
  check("|1.|Текст|Открыть окно|Отображается A\\|B| | | |");
  validateChecklist(`${header}\n|1.|Закрытие окна|Нажать крестик|Окно закрыто| | | |\nh2. Требует уточнения\n||Номер||Вопрос||Текущее наблюдение||Статус||\n|1.|Уточнить правило|Правило отсутствует|ТРЕБУЕТ УТОЧНЕНИЯ|`);
});
