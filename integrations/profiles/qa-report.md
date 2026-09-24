# QA Report capability profile

Use this optional profile for the QA Report editor documented at [maldenbergsergey-png/qa-report](https://github.com/maldenbergsergey-png/qa-report).

Follow the delivery and metadata rules in [`../../rules/checklist-delivery-rules.md`](../../rules/checklist-delivery-rules.md). Choose the channel from the user's request. A supplied temporary connection targets an existing open report; `qa_report_import_checklist` uses a different endpoint and cannot consume that connection.

For a supplied temporary connection, go directly to **Temporary API for an open report**. For results written during testing, also apply **Direct API workflow** below. An available general HTTP/terminal capability can execute this documented protocol under the rules above; the MCP tool inventory is not the full inventory of HTTP capabilities.

## Checklist-import connector

Send `POST {baseUrl}/api/checklists/import` with JSON:

```json
{
  "source": "testdocs-kit",
  "format": "jira",
  "title": "Readable checklist title",
  "issueKey": "https://jira.company.example/browse/TASK-123",
  "content": "h2. ..."
}
```

`format` and non-empty `content` are required. Despite its name, `issueKey` contains the full Jira issue URL for this integration. Preserve the returned `url`; do not construct it. The current QA Report contract stores the payload temporarily and puts only an import token in that URL.

The adapter validates an HTTP(S) base URL, requires `confirmed: true` for an explicitly requested import, sends content in the POST body, and returns the editor URL. It does not store Jira or QA Report credentials.

This connector's contract has no attachment-upload field. Its `issueUrl` tool argument is serialized as `issueKey` in the request above. Environment handling comes from the Jira markup parser described below. Use the temporary API when the user supplies a connection for delivery with files into an open report.

## Temporary API for an open report

Use the supplied `url`, `token`, and `expiresAt` only for that session. Send `X-QA-Import-Token: <token>` in every request. Keep the real connection and token out of repository files, examples, and logs. An expired connection requires renewed session details; do not substitute the checklist-import endpoint.

### HTTP client and credential handling

Use a purpose-built temporary-session tool if one is available, or perform the same requests through Node.js `fetch`, Python, an HTTP request tool, or `curl` launched by the available terminal. The session token belongs in `X-QA-Import-Token`, not `Authorization: Bearer`. The user-issued connection already supplies the scoped credential; no Jira credentials, new MCP installation, or additional generic write opt-in is needed for this channel.

Transfer the supplied token to the HTTP client through a supported private tool input, process memory/stdin, or an ephemeral private input/header file outside the repository. Preparing that input is part of executing the authorized request; do not ask the user to retype a usable token or configure an MCP solely for secret handling. If a file is needed, restrict its permissions to the current user (`0600` on POSIX) and remove that temporary credential file after use. Keep saved scripts token-free. Do not put a literal token in command-line arguments, enable shell tracing or verbose header logs, print the connection, or dump the process environment. A client-controlled request input carrying the credential to its intended endpoint is distinct from publishing it in output or reusable code.

Send requests only to the supplied session URL and the documented suffixes below. Use normal TLS verification, bounded request timeouts, and no automatic redirects carrying the token. Preserve payloads and batch IDs without credentials so an uncertain write can be checked or retried under the idempotency contract.

For example, once the agent has prepared a private header file containing `X-QA-Import-Token: <supplied token>`, these commands read context and then the receipt for a previously submitted batch. Variables refer to the actual supplied URL, private file path, and submitted batch ID; no token literal belongs in the commands:

```sh
curl -q --silent --show-error --fail-with-body --connect-timeout 10 --max-time 30 \
  --header "@$QA_IMPORT_HEADERS_FILE" "$QA_IMPORT_URL/context"

curl -q --silent --show-error --fail-with-body --connect-timeout 10 --max-time 30 \
  --header "@$QA_IMPORT_HEADERS_FILE" "$QA_IMPORT_URL/batches/$QA_IMPORT_BATCH_ID"
```

Parse the receipt JSON and match its `id` to the submitted batch. `status: "saved"` is the protocol's browser acknowledgement of persistence and is observable through any of these HTTP clients. The user's report tab must remain open to apply and acknowledge the batch; the agent does not need browser control or a special MCP tool to read that acknowledgement. `pending` means the receiving browser has not acknowledged the batch yet; it is not an inability of `curl` to verify saving. Visual inspection and metadata checks remain as described below, subject to the direct API boundary.

### Requests and receipts

1. `GET <url>/context` returns `reportId`, `expiresAt`, and `context.sections`, including section/row/column IDs and each cell's `text` and `hash`. Use these actual IDs and hashes for cell updates.
2. `PUT <url>/files/<fileId>` accepts real file bytes, with `X-QA-File-Name` set to `encodeURIComponent(filename)` and the MIME type in `Content-Type`. Do not generate Base64. File and batch IDs use 1–80 ASCII letters, digits, `_`, or `-`.
3. `POST <url>/batches` accepts JSON. Use `kind: "cells"` for targeted updates, or `kind: "checklist"`, `format: "jira"`, `content`, and optional `attachmentIds` for a full import. Apply the empty-template distinction below before treating an editor replacement dialog as a need for new user permission.
4. `GET <url>/batches/<id>` returns `pending`, `saved`, or `rejected`. Only `saved` confirms the browser saved the batch. Poll no more frequently than every 2–3 seconds, with a bounded wait (normally up to 30 seconds), and stop on session expiry or a terminal receipt. If still pending, retain the ID and continue independent work; check it again at the next delivery checkpoint. At completion report any pending ID instead of waiting indefinitely or submitting a duplicate batch.

A cell update contains `sectionId`, `rowId`, `columnId`, `expectedHash`, and optional `text`, `mode`, `attachmentIds`, and `status`. `text` replaces the entire cell, including old attachments; `mode: "append"` appends text. Omit `text` to add files to the existing cell. Take `expectedHash` from the context; it also covers row status. For full imports, `!filename.png!` and `[^filename.pdf]` refer to uploaded files by their exact names.

Use the supplied current batch schema for the envelope and its update-array field. The cell fields above do not define that field's name. If only individual update fields are documented, prepare the updates separately and resolve the missing envelope before submission; do not guess a `cells` or `updates` key, even in a draft claimed to be ready to send.

Cell `status` uses the editor's exact values: `OK`, `НЕ ОК`, `ПОЧТИ ОК`, `НЕ ПРОВЕРЕНО`, `ЧАСТИЧНО ПРОВЕРЕНО`, or `ТРЕБУЕТ УТОЧНЕНИЯ`. Map the report standard's `НЕ OK` and `ПОЧТИ OK` to the API's Cyrillic `ОК` spelling; the full Jira import normalizes those spellings itself.

After an uncertain network result, read the existing batch receipt. Repeating POST with the same ID and identical content is idempotent. Changed content needs a new ID; after a conflict, refresh the context and prepare the correction. Rejected batches release their files, so upload the required files again before a corrected submission. A pending batch is not a failed batch and must not be replaced with a new ID merely to retry.

### Direct API workflow

Apply the policy in [direct API delivery](../../rules/checklist-delivery-rules.md#direct-api-delivery). Treat the following as the inspected contract, not a promise that every newer session has the same capabilities. Read any supplied current schema; do not invent structure or metadata endpoints.

1. Read context once, verify the target report and distinguish a starter template from real content. Retain only the needed IDs, values and hashes in local task data; do not print the full context on every call. Resolve the batch envelope from the supplied contract before submission. When absent, ask only for that missing schema and continue independent preparation/testing; a list of cell fields is insufficient.
2. For a verified new report, bootstrap the planned sections, seven columns and rows in one `kind: "checklist", format: "jira"` batch. Serialize the canonical plan directly to the import payload, with empty actual results/statuses; the editor may represent unexecuted rows as `НЕ ПРОВЕРЕНО`. This replaces only the verified starter template within the fill request. No HTML or separate Jira export is needed. After `saved`, read context to bind generated IDs/hashes. If a replacement dialog prevents acknowledgement, report that API-only limitation; do not click it unless UI fallback was explicitly permitted.
3. For an existing suitable checklist, reuse its actual IDs and hashes and skip bootstrap. The inspected `cells` API only edits existing cells; it cannot create sections, columns or rows. Use structural operations only if documented by the current contract. If extra structure is required but unsupported, retain those rows locally and report the gap; do not repeatedly replace a live report to append results or erase user edits.
4. As a coherent group of checks finishes, upload its selected evidence bytes and submit targeted cell changes with the current hashes. Finalize text and attachment references together where supported; later `text` replacement removes old attachments, so preserve intended references when correcting a cell. Confirm `saved` before dependent updates to the same row. Refresh hashes once per subsequent batch that needs them (row status affects them), or after a conflict, rather than reading context per cell. Continue independent testing while a batch awaits acknowledgement; do not queue conflicting writes.
5. At completion, read receipts for unresolved batches and fetch one final context. Locally compare all delivered rows to the canonical record, using the status spelling map above and the destination's documented text representation. Check evidence bindings through supported reads; a saved receipt confirms persistence but cell-only context may not expose rendered attachments or report metadata. Return only the reconciliation summary and mismatches to model context. Use a brief read-only editor check only for a concrete uncertainty or when requested; report unsupported checks and unfilled fields without a browser editing detour.

Keep canonical rows, local evidence paths, destination IDs/hashes, batch IDs, payloads and delivery state in the task workspace, never the session credential. On an expired or blocked session, keep unsent changes there, continue independent checks when possible, and request renewed access only for delivery. Resume from receipts/current context without another test run or a generated HTML fallback.

### Attaching saved test evidence

Read the task's report and `reports/evidence-index.md` under the capture/reuse rules in [`../../rules/execution-evidence-rules.md`](../../rules/execution-evidence-rules.md). First apply [text-versus-file delivery rules](../../rules/checklist-delivery-rules.md#текстовые-данные-и-вложения): small saved text evidence becomes cell content, not a file upload. Map each required file to its checklist row, destination column, caption, upload ID, and exact uploaded filename, including evidence for `OK` rows.

For an existing checklist, resolve the current section/row/column IDs and hashes from `<url>/context`. Identify the actual-result column by its title and content, never by a remembered position or an assumption that the last text column is the destination. Execution screenshots must target `Фактический результат`, not `Комментарий`; expected-design images target `Ожидаемый результат`. Use attachment-only cell updates when the text is already correct. For a full checklist, put each uploaded filename inside its result cell after the complete result text, before that cell's closing `|`, and include its upload ID in the batch. Do not put image references in the next comment cell or create a separate image row.

Upload only the files selected above using binary PUT requests. A renewed session or a corrected/new batch may require uploading those bytes again because temporary server files are released; this is file delivery, not a new test run. Do not revisit the tested application merely to recreate attachments. Reuse one upload within a batch when the same file supports multiple rows. After `saved`, direct API delivery uses the compact reconciliation above; other delivery modes inspect cells when browser viewing is available for image loading, placement and code rendering. Report any verification limit. Apply the manual-Jira-publication boundary from `checklist-delivery-rules.md` when that is the user's chosen handoff.

### Код в ячейках

Для `kind: "checklist", format: "jira"` и checklist-import передавать блок кода внутри нужной ячейки как `{code:json}{"status":"signed"}{code}` или `{code}текст лога{code}`. Не использовать Markdown-backticks, экранированный HTML `<code>` или ссылку на маленький `.txt` вместо содержимого. Короткие технические идентификаторы при необходимости оформлять `{{field_name}}`, чтобы Jira-разметка не меняла их отображение.

Указанный ниже UI fallback относится к общей доставке. При прямой записи через API использовать только подтверждённое API-форматирование; если его нет, сохранить исходные данные и назвать ограничение, не заполняя редактор вручную и не заменяя весь отчёт ради одной ячейки.

Однострочные данные помещаются в обычную строку таблицы. Для многострочного кода сохранять реальные переводы строк, только если парсер выбранного канала подтверждённо собирает макрос в одной ячейке: проверить итоговый payload на доступном парсере/предпросмотре, включая строки с `|` и закрывающими маркерами. Не заменять переводы строк на буквальные `\n` или Jira `\\` внутри кода: это меняет данные. Вся таблица должна сохранить семь колонок. Если такой импорт не поддержан, использовать доступный блок кода в нужной ячейке редактора; не менять данные и не загружать небольшой текст файлом ради обхода форматирования.

У `kind: "cells"` поле `text` само по себе не объявляет формат Jira. Использовать его для макросов только при подтверждённом преобразовании этим каналом; не выдумывать `format` или HTML-поля. Иначе заполнить блок кода через редактор в рамках разрешённой операции. Не заменять существующий отчёт целиком только ради форматирования одной ячейки. Если доступного способа нет, сохранить подготовленный текст и назвать невыполненную часть доставки.

Пример формы строки показан в [учебном отчёте](../../examples/workflows/task-execution-report.md); его данные и имена файлов нельзя подставлять в реальный отчёт. После доставки проверить отображение блока, значимые символы и его колонку отдельно от receipt.

## Recognizing the empty starter report

The default editor shows **Ссылка на задачу** with an example URL placeholder, **Окружение** set to `STAGE`, **Итог** set to `OK`, an empty introduction with a hint, and **Основные проверки** with two empty rows. Cell hints such as `Проверка`, `Ожидаемый результат`, `Фактический результат`, and `Комментарий` are placeholders; row statuses start as `НЕ ПРОВЕРЕНО`. The summary shows zero checks. These visible defaults are not an existing test report or execution evidence.

For a user-identified new empty report, send the requested full checklist without asking “replace the existing report?”. The editor may still show a replacement dialog in some versions; an available browser capability can accept it for the verified starter template within a general fill request, but direct API delivery requires explicit permission for this UI fallback. Do not infer emptiness from row count or zero summary alone: an unexecuted checklist, introduction, attachments, or entered metadata may exist. The temporary API's cell-only context omits some of that information; use the supplied current report context or a brief read-only inspection when needed. Follow the preservation and replacement rules in `checklist-delivery-rules.md` for real existing content.

## Task link and environment mapping

The inspected QA Report implementation uses the following mappings. Check any newer supplied contract before relying on additional metadata support; extra JSON keys can be ignored without an error.

The editor actions below are a fallback for general delivery only. For direct API delivery, use supported API fields, preserve known task/stand links in supported report content, and report any dedicated field the API cannot set or verify. A content link does not prove that the dedicated field was populated. Do not open or edit the browser solely to complete unsupported metadata in this mode.

| Value | Checklist-import connector | Temporary API |
| --- | --- | --- |
| Full task URL | Tool `issueUrl` → request `issueKey` → report field `issueUrl` | No metadata write in the inspected `cells`/`checklist` contract; fill **Ссылка на задачу** in the editor after import |
| Environment category | Jira markup line `Окружение: DEV`, `Окружение: STAGE`, or `Окружение: PROD` | The same parser applies to `kind: "checklist"`; `cells` does not update the report environment |
| Short custom stand name | Fill **Окружение** with only the confirmed short name in the editor | Same; do not assume the parser preserves a custom name |
| Exact stand URL | One named link in the introduction; never append to **Окружение** | Same, using supported content; no invented metadata keys |
| Client environment and limitations | Compact introduction under [report rules](../../rules/execution-report-rules.md#краткие-вводные) | Same for `kind: "checklist"`; `cells` has no introduction write in the inspected contract |
| Files | Unsupported by this connector | Binary upload followed by batch attachment references |

The Jira parser starts with `environment: "STAGE"` when no environment line is present, recognizes `DEV`, `STAGE`, and `PROD`, and maps other captured environment names to `Локально`. These are parser behaviors, not defaults for a testing task. After a full import, check the **Окружение** field even when it was already correct before import. For a custom stand, set only the confirmed short name in the editor after the batch is saved. Keep its URL in the named content link, not in this field. If the stand designation is unknown, report it as unresolved; do not describe the parser's `STAGE` default as the tested stand.

The parser skips `Задача: ...` lines without filling `issueUrl`. The temporary API context also omits report-level `issueUrl` and `environment`, so cell context and a `saved` receipt cannot verify them. Read the existing metadata in the editor when available, preserve correct values, and verify the final fields after import. Do not claim that adding `issueKey`, `issueUrl`, `environment`, or `stand` to a temporary batch updates these fields without a newer documented contract.

For a stand link in the introduction, use a named Jira Wiki link such as `Адрес стенда: [Тестовый стенд|https://test.company.example]` before the first table, substituting only the supplied URL. This preserves the link in the content; it does not replace filling the environment field. Use `Окружение: ...` only for a confirmed parser-supported category. Keep planned and executed testing distinct; a metadata line must not fabricate a test result.

The mapping is based on QA Report's `local-import-server.js` (`validateBatch`), `local-import-client.js` (`context`, `acceptBatch`), `jira-markup-import.js` (`parseJiraMarkup`), and `app.js` (`applyImportedChecklist`, `importedDraftInCurrentReport`).

For opening the editor, follow [the delivery contract](../../rules/checklist-delivery-rules.md).
