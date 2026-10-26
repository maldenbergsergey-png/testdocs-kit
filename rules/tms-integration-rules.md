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
Изображения шагов: файл/ID/URL, подпись, точный шаг и назначение
```

Do not assume that test cases are Jira issues. Some products store them as separate test objects; others represent them through Jira issue types or vendor-specific entities. Use the capabilities exposed by the connected MCP server and preserve unsupported fields as explicit gaps.

For [case images](test-case-image-rules.md), confirm file upload, exact step and target cell, clickable inline thumbnails, display/read-back, and replacement/removal separately. Thumbnails belong under the action or expected-result text and must open the original image. Case-level attachments, links, execution evidence and inline step images are different capabilities. Use only the selected provider's supported schema; never infer an attachment endpoint or embed local paths, base64 or expiring export URLs in published steps. A missing capability leaves a prepared file and placement proposal, not a claimed upload. Preserve existing image bindings when replacing scripts; if preservation cannot be verified, stop the affected update at a proposal.

Do not assume that a Test Run/Test Cycle is a Jira issue or that creating the container also attaches cases, links release tasks, creates executions, or assigns testers. Inspect and validate each supported operation and return the stable run identifier and URL supplied by the connector.

Do not treat request echo fields or a create-response count as proof of item assignment. Read the created Test Run back and compare its saved item assignees with the preflight mapping. A connector may use the public Test Result `assignedTo` update once for a mismatched existing item, but it must verify the saved result afterward and preserve a partial-failure state when any mismatch remains.

Treat Test Run folders separately from test-case folders. The public Server/DC search discovers paths represented by existing runs; it cannot prove an empty folder exists. Separately enabled management can read the internal TEST_RUN tree, including empty folders. Root creation omits `folder`; it does not send `/`. Existing-run changes follow [existing-run rules](test-run-rules.md#existing-test-run-management) and the selected provider profile, preserving the same key and retained results.

Do not assume modern Zephyr Scale endpoints, cloud field names, versioning, or call-step behavior for a legacy Test Management for Jira installation. Confirm the deployment, product version, and actual MCP tool schema first.

The installer records one active TMS provider: `zephyr_scale` for Zephyr Scale / legacy Test Management for Jira, or `qa_tools` for QA Tools (ТестОпс). Zephyr shares the configured Jira connection and requires no separate base URL or credentials. QA Tools is an independent connection and requires its instance URL plus an API token or local username/password authentication. Use the selected provider's exposed capabilities only; do not query both TMS products speculatively.

For QA Tools, prefer the vendor's version-matched `testops_*` MCP tools over hard-coded REST endpoints. Treat `testops_find_*`, `testops_get_*`, and `testops_list_*` as reads. After installer opt-in, only `testops_create_testcase` is exposed as a write and requires exact user approval. Other mutations remain hidden because the proxy lacks a current-session creation registry. The local proxy never exposes tool names containing `delete` or `remove`.
