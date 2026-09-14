# TMS compatibility

## TMS compatibility

Map any supported test-management product to the neutral test-case fields:

```text
Стабильный идентификатор и версия кейса
Название
Цель
Предусловия
Путь
Шаг, тестовые данные и ожидаемый результат в отдельных полях каждой строки
Постусловия
Теги типа и платформы
Статус
Приоритет
Папка или иерархия
Связи с требованиями и задачами
Комментарии и причина изменения при актуализации
Переиспользуемая подготовка или вызываемые общие шаги
```

Do not assume that test cases are Jira issues. Some products store them as separate test objects; others represent them through Jira issue types or vendor-specific entities. Use the capabilities exposed by the connected MCP server and preserve unsupported fields as explicit gaps.

Do not assume that a Test Run/Test Cycle is a Jira issue or that creating the container also attaches cases, links release tasks, creates executions, or assigns testers. Inspect and validate each supported operation and return the stable run identifier and URL supplied by the connector.

Do not treat request echo fields or a create-response count as proof of item assignment. Read the created Test Run back and compare its saved item assignees with the preflight mapping. A connector may use the public Test Result `assignedTo` update once for a mismatched existing item, but it must verify the saved result afterward and preserve a partial-failure state when any mismatch remains.

Treat Test Run folders separately from test-case folders. For Zephyr Server/DC, use the public Test Run search endpoint to discover exact paths represented by existing runs. The public API exposes folder create/update but no folder-tree read, so do not claim that an empty folder was checked. Root Test Run creation omits the `folder` field; it does not send `/`.

Do not assume modern Zephyr Scale endpoints, cloud field names, versioning, or call-step behavior for a legacy Test Management for Jira installation. Confirm the deployment, product version, and actual MCP tool schema first.

The installer records one active TMS provider: `zephyr_scale` for Zephyr Scale / legacy Test Management for Jira, or `qa_tools` for QA Tools (ТестОпс). Zephyr shares the configured Jira connection and requires no separate base URL or credentials. QA Tools is an independent connection and requires its instance URL plus an API token or local username/password authentication. Use the selected provider's exposed capabilities only; do not query both TMS products speculatively.

For QA Tools, prefer the vendor's version-matched `testops_*` MCP tools over hard-coded REST endpoints. Treat `testops_find_*`, `testops_get_*`, and `testops_list_*` as reads. After installer opt-in, only `testops_create_testcase` is exposed as a write and requires exact user approval. Other mutations remain hidden because the proxy lacks a current-session creation registry. The local proxy never exposes tool names containing `delete` or `remove`.
