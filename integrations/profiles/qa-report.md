# QA Report capability profile

Use this optional profile for the QA Report editor documented at [maldenbergsergey-png/qa-report](https://github.com/maldenbergsergey-png/qa-report).

Follow the delivery and metadata rules in [`../../rules/integration-rules.md`](../../rules/integration-rules.md). Choose the channel from the user's request. A supplied temporary connection targets an existing open report; `qa_report_import_checklist` uses a different endpoint and cannot consume that connection.

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

1. `GET <url>/context` returns `reportId`, `expiresAt`, and `context.sections`, including section/row/column IDs and each cell's `text` and `hash`. Use these actual IDs and hashes for cell updates.
2. `PUT <url>/files/<fileId>` accepts real file bytes, with `X-QA-File-Name` set to `encodeURIComponent(filename)` and the MIME type in `Content-Type`. Do not generate Base64. File and batch IDs use 1–80 ASCII letters, digits, `_`, or `-`.
3. `POST <url>/batches` accepts JSON. Use `kind: "cells"` for targeted updates, or `kind: "checklist"`, `format: "jira"`, `content`, and optional `attachmentIds` for a full import. Apply the empty-template distinction below before treating an editor replacement dialog as a need for new user permission.
4. `GET <url>/batches/<id>` returns `pending`, `saved`, or `rejected`. Only `saved` confirms the browser saved the batch. Poll no more frequently than every 2–3 seconds and stop on session expiry or a terminal receipt; if the browser is not confirming, report the pending ID instead of submitting a duplicate batch.

A cell update contains `sectionId`, `rowId`, `columnId`, `expectedHash`, and optional `text`, `mode`, `attachmentIds`, and `status`. `text` replaces the entire cell, including old attachments; `mode: "append"` appends text. Omit `text` to add files to the existing cell. Take `expectedHash` from the context; it also covers row status. For full imports, `!filename.png!` and `[^filename.pdf]` refer to uploaded files by their exact names.

Cell `status` uses the editor's exact values: `OK`, `НЕ ОК`, `ПОЧТИ ОК`, `НЕ ПРОВЕРЕНО`, `ЧАСТИЧНО ПРОВЕРЕНО`, or `ТРЕБУЕТ УТОЧНЕНИЯ`. Map the report standard's `НЕ OK` and `ПОЧТИ OK` to the API's Cyrillic `ОК` spelling; the full Jira import normalizes those spellings itself.

After an uncertain network result, read the existing batch receipt. Repeating POST with the same ID and identical content is idempotent. Changed content needs a new ID; after a conflict, refresh the context and prepare the correction. Rejected batches release their files, so upload the required files again before a corrected submission. A pending batch is not a failed batch and must not be replaced with a new ID merely to retry.

### Attaching saved test evidence

Read the task's report and `reports/evidence-index.md` under the capture/reuse rules in [`../../rules/task-execution-rules.md`](../../rules/task-execution-rules.md). Map each selected local file to its checklist row, caption, upload ID, and exact uploaded filename, including evidence for `OK` rows. For an existing checklist, resolve the current section/row/column IDs and hashes from `<url>/context`; use attachment-only cell updates when the text is already correct. For a full checklist, put the uploaded filenames into the corresponding Jira Wiki cells after their result text and include their upload IDs in the batch.

Upload the saved original files using binary PUT requests. A renewed session or a corrected/new batch may require uploading those bytes again because temporary server files are released; this is file delivery, not a new test run. Do not revisit the tested application merely to recreate attachments. Reuse one upload within a batch when the same file supports multiple rows. After `saved`, inspect the QA Report cells when browser viewing is available to check that images load under the right results; report any visual verification limit. Apply the manual-Jira-publication boundary from `integration-rules.md` when that is the user's chosen handoff.

## Recognizing the empty starter report

The default editor shows **Ссылка на задачу** with an example URL placeholder, **Окружение** set to `STAGE`, **Итог** set to `OK`, an empty introduction with a hint, and **Основные проверки** with two empty rows. Cell hints such as `Проверка`, `Ожидаемый результат`, `Фактический результат`, and `Комментарий` are placeholders; row statuses start as `НЕ ПРОВЕРЕНО`. The summary shows zero checks. These visible defaults are not an existing test report or execution evidence.

For a user-identified new empty report, send the requested full checklist without asking “replace the existing report?”. The editor may still show a replacement dialog in some versions; an available browser capability can accept it for the verified starter template within the user's fill request. Do not infer emptiness from row count or zero summary alone: an unexecuted checklist, introduction, attachments, or entered metadata may exist. The temporary API's cell-only context omits some of that information; use the supplied current report context or inspect the editor when needed. Follow the preservation and replacement rules in `integration-rules.md` for real existing content.

## Task link and environment mapping

The inspected QA Report implementation uses the following mappings. Check any newer supplied contract before relying on additional metadata support; extra JSON keys can be ignored without an error.

| Value | Checklist-import connector | Temporary API |
| --- | --- | --- |
| Full task URL | Tool `issueUrl` → request `issueKey` → report field `issueUrl` | No metadata write in the inspected `cells`/`checklist` contract; fill **Ссылка на задачу** in the editor after import |
| Environment category | Jira markup line `Окружение: DEV`, `Окружение: STAGE`, or `Окружение: PROD` | The same parser applies to `kind: "checklist"`; `cells` does not update the report environment |
| Custom stand name or exact stand URL | Preserve in the report introduction and fill **Окружение** in the editor | Same; do not pass a custom name or URL as though the parser preserves it |
| Files | Unsupported by this connector | Binary upload followed by batch attachment references |

The Jira parser starts with `environment: "STAGE"` when no environment line is present, recognizes `DEV`, `STAGE`, and `PROD`, and maps other captured environment names to `Локально`. These are parser behaviors, not defaults for a testing task. After a full import, check the **Окружение** field even when it was already correct before import. For a custom stand, set the exact known name/URL in the editor after the batch is saved. If the environment is unknown, report it as unresolved; do not describe the parser's `STAGE` default as the tested stand.

The parser skips `Задача: ...` lines without filling `issueUrl`. The temporary API context also omits report-level `issueUrl` and `environment`, so cell context and a `saved` receipt cannot verify them. Read the existing metadata in the editor when available, preserve correct values, and verify the final fields after import. Do not claim that adding `issueKey`, `issueUrl`, `environment`, or `stand` to a temporary batch updates these fields without a newer documented contract.

For a stand link in the introduction, use a named Jira Wiki link such as `Адрес стенда: [Тестовый стенд|https://test.company.example]` before the first table, substituting only the supplied URL. This preserves the link in the content; it does not replace filling the environment field. Use `Окружение: ...` only for a confirmed parser-supported category. Keep planned and executed testing distinct; a metadata line must not fabricate a test result.

The mapping is based on QA Report's `local-import-server.js` (`validateBatch`), `local-import-client.js` (`context`, `acceptBatch`), `jira-markup-import.js` (`parseJiraMarkup`), and `app.js` (`applyImportedChecklist`, `importedDraftInCurrentReport`).

## Opening behavior

Open the returned URL only after an explicit user request, in a separate external browser tab/window. Do not embed QA Report into the AI client or another page. When browser control is unavailable, show a clickable link for the user.
