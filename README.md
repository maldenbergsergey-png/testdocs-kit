# Testdocs Kit

Переносимый набор правил, AI-скиллов и MCP-серверов для исследования задач, выполнения тестирования и создания тестовой документации.

Инструмент работает как intent-based QA-assistant: получает задачу, документ, ссылку, файл, свободное описание дефекта или тест-кейсы и сам выбирает только нужные skills. Он умеет объяснить подход к проверке, выполнить доступные проверки и сформировать отчёт, а также создавать Jira-чек-листы и баг-репорты, полный пакет документации, отдельные и task-only кейсы, проводить review и оптимизировать существующий набор. Имена skills пользователю знать не нужно; дополнительные skills подключаются по мере появления реальной необходимости.

Поддерживаются:

- Codex Desktop, CLI и IDE;
- Claude Code;
- стабильный OpenCode и экспериментальный OpenCode V2;
- другие клиенты, которые поддерживают MCP и стандарт Agent Skills.

## Начало работы

- [Установка, обновление и настройка подключений](docs/installation.md)
- [Запросы обычным языком и примеры результатов](docs/usage.md)
- [Решение проблем установки](docs/troubleshooting.md)
- [Возможности и ограничения MCP](docs/mcp-boundaries.md)

Опишите задачу и нужный результат: объяснение подхода, checklist, кейсы, выполнение проверок, оценку или полный пакет. Агент выбирает подходящий скилл и добавляет чтение внешних источников только при необходимости. Прямые вызовы скиллов также поддерживаются.

## Доступные скиллы

| Скилл | Назначение |
| --- | --- |
| [`prepare-task-testing`](skills/prepare-task-testing/SKILL.md) | Полный пакет документации или уточнение неоднозначного запроса на подготовку тестирования. |
| [`explain-task-testing`](skills/explain-task-testing/SKILL.md) | Объяснить, как проверить изменение, без артефакта или прогона. |
| [`execute-task-testing`](skills/execute-task-testing/SKILL.md) | Выполнить доступные проверки и вернуть отчёт с доказательствами. |
| [`qa-task-estimation`](skills/qa-task-estimation/SKILL.md) | Оценить трудозатраты QA, дополнительные регрессию/ретест, пересчитать часы или сравнить их с фактом. |
| [`create-bug-report`](skills/create-bug-report/SKILL.md) | Превратить свободное или голосовое описание в баг-репорт и по явному запросу создать Bug с учетом полей конкретного Jira-проекта. |
| [`generate-test-checklist`](skills/generate-test-checklist/SKILL.md) | Сформировать checklist по задаче, документу или требованиям в Jira Wiki Markup. |
| [`collect-test-context`](skills/collect-test-context/SKILL.md) | Собрать контекст из Jira, Confluence, TMS, чата или файлов. |
| [`generate-test-cases`](skills/generate-test-cases/SKILL.md) | Создать новые тест-кейсы. |
| [`analyze-test-coverage`](skills/analyze-test-coverage/SKILL.md) | Определить пробелы и необходимость создания или обновления кейсов. |
| [`update-test-cases`](skills/update-test-cases/SKILL.md) | Показать diff и полную предлагаемую версию; применить можно только исправление кейса, созданного текущим MCP-процессом. |
| [`review-test-cases`](skills/review-test-cases/SKILL.md) | Проверить качество и сразу показать исправленную proposal-версию при замечаниях. |
| [`build-coverage-matrix`](skills/build-coverage-matrix/SKILL.md) | Построить матрицу тестового покрытия. |
| [`build-regression-model`](skills/build-regression-model/SKILL.md) | Собрать переиспользуемую регрессионную модель. |
| [`create-release-test-run`](skills/create-release-test-run/SKILL.md) | Собрать Test Run по версии релиза, найти связанные и смысловые кейсы в заданной папке, распределить их между тестировщиками и по явному запросу создать Test Run со связанной QA-задачей. |
| [`derive-test-case-standard`](skills/derive-test-case-standard/SKILL.md) | Вывести общие правила из тестовой документации и инструкций. |

## Структура репозитория

```text
testdocs-kit/
├── README.md
├── AGENTS.md
├── package.json
├── certificates/       # дополнительные публичные CA-сертификаты
├── scripts/            # установка, launcher и проверка
├── rules/              # источник правил тестовой документации
├── skills/             # переносимые Agent Skills
├── docs/               # установка и примеры пользовательских запросов
├── evals/              # корпус и процедура проверки маршрутизации
├── examples/           # короткие универсальные примеры
├── integrations/       # контракты Jira, Confluence и TMS
└── mcp/
    ├── browser-mcp/
    ├── jira-mcp/
    ├── confluence-mcp/
    └── qa-tools-mcp/
```

Папка `rules/` является источником истины. Скиллы используют общие правила и не должны создавать собственную противоречащую политику.

## Контракты и разработка

- [Общие правила](rules/core.md) и [маршрутизация](rules/task-testing-rules.md)
- [Стандарт кейсов](rules/test-case-standard.md), [формат](rules/test-case-format.md) и [административная подготовка](rules/test-case-setup-rules.md)
- [Правила выполнения](rules/task-execution-rules.md) и [публикации](rules/external-write-rules.md)
- [Проверки структуры и маршрутизации](evals/README.md)

При рефакторинге сохраняйте требования в `rules/`; в скиллах оставляйте процедуру и условные ссылки на правила. Проверка пакета: `npm test`.
