# Zephyr Scale capability profile

Use this profile for modern Zephyr Scale or its current Zephyr-family successor when the connected MCP server exposes test-library operations.

## Important boundary

Zephyr Scale test cases may be vendor-managed test objects rather than ordinary Jira issues. A generic Jira issue reader is therefore not sufficient evidence of TMS access.

## Read capability checklist

Confirm that the MCP server can:

- retrieve a case by stable key or ID;
- retrieve the complete current version, including steps, test data, and expected results;
- retrieve objective, preconditions, tags, priority, status, path, folder, and custom fields when present;
- find cases linked to a supplied Jira issue or requirement;
- retrieve version history, comments, or an actualization reason when updating;
- identify reusable or called-step dependencies when supported.

Preserve raw field and lifecycle values. Map them to the neutral context bundle only after the project approves the mapping.

## Write capability checklist

Follow [external write rules](../../rules/external-write-rules.md) and the [temporary update restriction](../../rules/update-rules.md). For the selected Zephyr connection, the bundled adapter exposes creation and registry-guarded correction without installer opt-in. Create only on explicit create intent; correct only new cases created in this same chat on explicit correction intent. The current MCP creation registry is an additional guard, not permission to edit another chat's case. Previously existing cases remain proposal-only, regardless of baseline fingerprints. Use the field mapping below for supported operations.

## Test Run capability checklist

For a release Test Run/Test Cycle workflow, confirm separately that the connector can:

- resolve the exact release version and retrieve its Jira issues;
- list all complete cases inside an exact existing folder boundary;
- discover exact Test Run folder paths represented by existing Test Runs; root creation omits `folder`, while empty Test Run folders remain undiscoverable through the public API;
- find cases linked to each release issue;
- create a Test Run/Test Cycle with a stable returned key and URL;
- attach the selected cases and release issues;
- create executions and assign each one to an exact user;
- read a created Test Run back, verify every saved assignment, and apply the public item-level `assignedTo` correction once when creation ignored it;
- expose a stable Test Run value accepted by the Jira project's semantic test-coverage field or relation.

The bundled Server/DC adapter uses the official public `POST /rest/atm/1.0/testrun` operation with the complete `items` list. Each item carries its test-case key and resolved Jira `userKey`; release tasks are supplied in `issueLinks`. Preflight the full deduplicated set before creation. Item assignment can be corrected through the documented Test Result `assignedTo` field after a read-back mismatch and verified again. Further changes follow the separate management capability below; never delete/recreate a run automatically.

Do not treat test-case creation capability as Test Run capability. Resolve testers through Jira assignable-user search and use the connector-returned user key rather than a display name or email address.

## Existing-run management

Use [`manage-test-run`](../../skills/manage-test-run/SKILL.md) and [existing-run rules](../../rules/test-run-rules.md#existing-test-run-management). Public `zephyr_search_test_runs`, `zephyr_get_test_run`, and `zephyr_get_test_run_results` remain read-only and available without management opt-in. Search accepts project/folder scope and pagination; filter candidate names/statuses after reading. Results use `GET /rest/atm/1.0/testrun/{key}/testresults/page`; only a 404/405 triggers the legacy flat-list fallback after confirming the run exists. Other errors remain errors.

The [official public RAML](https://support.smartbear.com/zephyr-scale-server/api-docs/v1/kanoah/api.raml) has no run-header or composition update operation. Those operations use the unofficial UI API under `/rest/tests/1.0`, which depends on the installed Zephyr version and is not vendor-supported. Request shapes were cross-checked against the [reference implementation](https://github.com/vilaabo/zephyr-scale-mcp/blob/9c43dc5080f776f69ef7f7a25222833e79347057/src/tools/runMaintenance.ts) and its [internal mappings](https://github.com/vilaabo/zephyr-scale-mcp/blob/9c43dc5080f776f69ef7f7a25222833e79347057/src/internal.ts); this does not prove compatibility with the user's installation. Incompatible/incomplete responses stop the affected operation, without guessing alternate mutations or recreating a run.

Enable only the selected Zephyr-linked Jira connection with `npm run update -- --enable-test-run-writes`, or `npm run setup -- --reuse --enable-test-run-writes` when the checkout is already updated. Saved `enableTestRunManagement` launches MCP with `TESTDOCS_ENABLE_TEST_RUN_MANAGEMENT=1`. This opt-in includes deletion and acceptance of the internal API. Existing `--enable-release-test-run-writes` / `enableReleaseTestRunCreation` approvals remain limited to creation and assignment repair; updates and general Jira write opt-in do not enable management automatically. Every mutation still needs explicit operation intent and `confirmed: true`.

- `zephyr_get_test_run_items`: public complete run plus internal `GET /testrun/{key}` identity and `GET /testrun/{id}/testrunitems`; returns stable IDs, current data and `_testdocs.contentHash`. Count/identity mismatches stop edits. Public `run.items[].id` identifies the latest execution, not a stable item.
- `zephyr_get_test_run_folder_tree`: Jira project identity, then internal `GET /project/{id}/foldertree/testrun`, including empty folders. Use this TEST_RUN tree only; the search-based folder tool remains available without management opt-in.
- `zephyr_update_test_run`: internal `PUT /testrun/{id}` with `id`, `projectId` and supplied `name`, `folderId`, `plannedStartDate`/`plannedEndDate`. Dates require a timezone and normalize to UTC with milliseconds. Moves require a positive ID in this project's TEST_RUN tree. Moving to root and other header fields are not exposed by this mapping.
- `zephyr_add_test_run_items`, `zephyr_remove_test_run_items`, `zephyr_reorder_test_run_items`: internal `PUT /testrunitem/bulk/save` with `testRunId`, all four arrays (`addedTestRunItems`, `updatedTestRunItems`, `updatedTestRunItemsIndexes`, `deletedTestRunItems`) and `autoReorder: false`. Additions resolve case keys to numeric IDs and carry `lastTestResult.assignedTo`, with indexes starting at zero within the added batch. Retained items shift during addition, then a separately verified full index update appends new cases. Removal sends only stable item IDs as `{id}` and compacts surviving indexes in a follow-up call when needed. Reordering supplies every stable item ID exactly once. Removing an item deletes its executions; source cases stay intact.
- `zephyr_update_test_run_result`: guarded public `PUT /testrun/{key}/testcase/{testCaseKey}/testresult`, changing only supplied latest-result `status`, `assignedTo` or `comment`. Duplicate configurations are rejected as ambiguous. Other execution fields and new execution creation are not exposed here. Do not simulate aggregate run status by overwriting case results.
- `zephyr_delete_test_run`: guarded public `DELETE /testrun/{key}` with explicit whole-run deletion intent; verify absence by a 404 for the same key. Do not delete source cases or linked Jira work items.

All management mutations require the snapshot hash as `expectedContentHash`. A conflict fails before mutation; the hash is an optimistic check, not a server-side atomic lock. `VERIFIED` requires saved-state comparison, including retained execution identities/data. `FAILED` means the saved diff differs; `UNAVAILABLE` means verification could not finish. Composition edits also report their `phase`; `mutationOutcome: UNKNOWN` requires inspection before any retry. Re-read the snapshot after each change before another mutation. Never repeat an uncertain mutation or recreate/delete the run as recovery.

## Execution statistics

`zephyr_get_test_run_statistics` is read-only and available for the selected Zephyr provider without write/management opt-in. It uses the existing authenticated Jira/Zephyr transport, with no new credentials, service or persistent collector. Inputs are an exact `testRunKey`, required IANA `timeZone`, optional `date` (today by default) or inclusive `startDate` and `endDate`, optional exact `initialStatuses` (default `["Not Executed"]`), `historyPath`, `historyMode` (`auto` by default, or `public_records` to skip internal audit), and `includeRecordedSummary` (default false). See the [statistics rules](../../rules/test-run-rules.md#execution-statistics) and [procedure](../../skills/manage-test-run/references/execution-statistics.md).

The [official Server/DC RAML](https://support.smartbear.com/zephyr-scale-server/api-docs/v1/kanoah/api.raml) and [paginated result example](https://support.smartbear.com/zephyr-scale-server/api-docs/v1/kanoah/testresults_by_testrun_paginated_get.example), checked 2026-10-30, establish:

- `GET /rest/atm/1.0/testrun/{key}/testresults/page?onlyLastExecutions=false` returns all saved execution results, not an immutable status-change log. The adapter follows actual page lengths (including server page caps) to `total`, rejects missing/overlapping execution IDs, stalls, changing totals, mismatched offsets and inconsistent last-page flags. On a first-page 404/405 it reads the legacy flat list once after confirming the run identity. HTTP 400/401/403/5xx and later-page errors do not trigger fallback. Pagination has no atomic server snapshot; it cannot prove there were no concurrent same-count edits.
- Result fields include `executedBy` (recorded executor), `assignedTo` (assignee), `actualEndDate` and legacy `executionDate`. A record's `executedBy` is not independently verified as the author of each status edit; `actualEndDate` is execution time, not a documented status-change audit timestamp. Never substitute `assignedTo`, ambiguous `userKey` or arbitrary `updatedBy` for a transition actor. Exact user keys can be resolved with existing Jira `GET /rest/api/2/user?key=...`; failed name lookup preserves the key, without substituting an assignable user.
- Public `PUT /testrun/{key}/testcase/{caseKey}/testresult` updates the last result's defined fields, including status. Reading every execution therefore does not recover every intermediate edit or a reliable historical cutoff status. The published RAML exposes no complete execution status-audit endpoint with old/new status, change timestamp and action author. Do not invent an internal history route or use Jira issue changelog for Zephyr execution objects. Compatibility of a separately observed UI history must be established on that installation.

The default `auto` route additionally uses the internal UI audit, confirmed against the test-player history dialog, loaded endpoint implementation and live JSON on Zephyr **12.12.0-jira11**, 2026-10-30. This version-dependent read mapping is separate from the public RAML:

- Internal `GET /testrun/{key}?fields=id,projectId,key` confirms numeric identity; `GET /project/{projectId}/testresultstatus` returns `name`, `i18nKey`, `id` and `projectId`. Map audit status codes through this dictionary, retaining custom names; an unknown/ambiguous mapping excludes affected cases or stops the report.
- Internal `GET /testresult/{executionId}/history?startAt=...&maxResults=200` returns `{results,total,startAt,maxResults,last}`. Respect actual returned counts/server caps and reject overlaps, stalls and inconsistent totals/last flags. Each row has stable `id`, `source: TEST_EXECUTION`, matching `sourceId`, `type`, `historyDate`, action author `userKey`, and `changeHistoryItems`. Only an item's exact `fieldName: STATUS` supplies `originalValue`/`newValue`; `TEST_SCRIPT.STEP.STATUS`, `EXECUTED_BY`, dates, assignments and comments are not case-status events. The history row's `userKey` is the action author, unlike the public result's ambiguous/deprecated `userKey`. The UI displays that row as "Изменено кем". Require offset-bearing `historyDate`; use history/change IDs as evidence, never as a guessed chronology for timestamp ties.
- Internal `GET /testrun/{numericId}/history` currently returns a flat array (a supported paged envelope is also handled). Require a matching source/identity and a `CREATE` anchor. `TEST_CASES` changes with removed original case keys since the report start identify potentially deleted execution histories, including removals after a historical cutoff: exclude those cases and mark the report partial. Removals predating the requested period do not create a gap for it. A missing creation anchor cannot prove complete audit retention.
- Read every saved execution/configuration's audit, including previous attempts, at most four requests concurrently. Require each creation anchor, continuous known status transitions from the initial baseline, and consistency with the saved status when no post-cutoff change explains a difference. Re-read the run and compare current item/execution identities; concurrent composition changes stop exact totals. This is not an atomic database snapshot. Unsupported shapes/access failures stop the audit route without retries or guessed alternate endpoints; return the sanitized failure with unavailable exact totals. Missing author/order/baseline and deleted-case gaps produce `PARTIAL_HISTORY`, never a complete total.

Without a verified complete audit, the tool returns `HISTORY_UNAVAILABLE`, null exact rows/totals and the inventory size. `includeRecordedSummary: true` adds `LIMITED_EXECUTION_RECORDS` when needed for an explicitly limited summary or statistical alternatives: saved non-initial results dated within the elapsed interval, deduplicated by case/local day with the last recorded time winning across testers/configurations. Its statuses belong to those mutable records, not necessarily the historical cutoff. Missing executor/time/status and conflicting timestamp ties exclude affected cases. It cannot prove initial-state transitions or recover overwritten/deleted data. Do not present it as exact daily work, even when its table looks plausible.

If the live UI audit is unavailable, the alternative for retrospective transition counts is a verified full audit export from this installation (or an existing authorized event archive), normalized outside the repository to this v1 contract:

```json
{
  "version": 1,
  "instance": "https://jira.example.invalid",
  "testRunKey": "DEMO-R101",
  "source": "Audit export reference, revision and verified scope",
  "complete": true,
  "startInclusive": "2026-10-29T21:00:00Z",
  "endExclusive": "2026-10-30T21:00:00Z",
  "events": [
    {
      "id": "source-event-id",
      "executionId": "stable-execution-or-configuration-stream-id",
      "testCaseKey": "DEMO-T1",
      "timestamp": "2026-10-30T10:00:00+03:00",
      "fromStatus": "Not Executed",
      "toStatus": "Passed",
      "actor": "actual-action-user-key"
    }
  ]
}
```

`complete` attests all status events for every run item/configuration, including removals, through the elapsed cutoff; do not set it on a saved-result export. `source` must identify actual evidence. `instance` must match the selected connection's origin and `testRunKey` must match exactly. Timestamps require explicit offsets; the export covers the entire elapsed requested interval. `executionId` groups a continuous status stream. Event IDs deduplicate identical events; conflicting duplicates fail. Optional nonnegative integer `sequence` supplies source-established ordering for equal timestamps across the case; arbitrary ID order is not chronology. `actor: null` preserves unknown authors. Retain earlier baseline events when available; events after cutoff are ignored for counts and statuses.

`historyPath` reads an explicitly supplied absolute regular JSON file (at most 100 MiB); it does not fetch arbitrary URLs. Returns `HISTORY_BASED` or `PARTIAL_HISTORY`, case/day evidence IDs, exclusions, period boundaries, provisional cutoff and source SHA-256. These qualities describe calculation from supplied evidence, not live audit verification. Do not manufacture transitions from adjacent public results or claim that the hash proves completeness. Large exports beyond this limit require a scoped source export; never truncate and mark complete.

For future collection, the official [TestExecutionChangedEvent Java API](https://support.smartbear.com/zephyr-scale-server/javadocs/9.21.1/com/adaptavist/tm4j/api/event/testexecution/TestExecutionChangedEvent.html) exposes `getGeneratedByUser()` and execution identity. It is a possible server-side integration point, not a retrospective REST history or a guarantee that old/new status and event timestamps are archived. A verified UI export, existing audit archive or separately approved server integration can supply missing evidence; installing a collector/database/runtime is outside this pack change.

## Compatibility

For a `400` or `403`, preserve the exact operation and observed response; `403 Forbidden` alone does not prove missing project or folder permissions. Use the bundled `jira_get_connection_diagnostics` read-only tool to inspect the running adapter's source path, code fingerprint, selected Jira connection, saved gateway-header presence, and last sanitized HTTP error. This tool performs no network request and does not retry creation. A configured corporate `X-Sp-Secret` is part of the connection's normal authentication; keep its value outside chat and use the standard adapter's saved configuration. If the tool is absent or `lastHttpError` is null, report that diagnostic gap rather than inventing header values or a permission diagnosis. Use the observed transaction/request ID for gateway-side verification. Preserve actual client denials and the existing write boundary.

Do not hard-code one Cloud, Server, or Data Center API schema into the QA skills. Record deployment and product version in the connection profile, then adapt the MCP tool output to `rules/integration-rules.md`.

The bundled Jira MCP reads a complete Server/Data Center or compatible TM4J case through `/rest/atm/1.0/testcase/{key}` when available. It orders `testScript.steps` by `index`. When that endpoint is unavailable, it falls back internally to search and returns `_testdocs.complete: false`; do not treat that metadata-only response as evidence that the steps were checked. Search accepts a project key for the compatible `/rest/atm/1.0/testcase/search` endpoint and can recover a supported endpoint internally, reducing repeated client-visible failures.

For creation, the bundled adapter uses the public Server/Data Center `POST /rest/atm/1.0/testcase` contract with a `STEP_BY_STEP` script. It maps each Markdown row to separate `description`, optional `testData`, and `expectedResult` fields, and converts `[label](https://...)` in rich-text values into clickable Zephyr links. The target folder must already exist; the adapter does not create or move folders. Complete case reads return `_testdocs.contentHash`; metadata-only fallback does not. Case reads, creation, and permitted updates return `_testdocs.webUrl` when a stable key is available.

## Images in test-case steps

Apply [case image rules](../../rules/test-case-image-rules.md). The required result is a clickable miniature directly below the text in `description` ("Шаг") or `expectedResult`, opening the original image. A native step attachment or a text link alone is insufficient.

For Server/DC, the adapter uses the official [public API](https://support.smartbear.com/zephyr-scale-server/api-docs/v1/): case-level `GET`/`POST /rest/atm/1.0/testcase/{testCaseKey}/attachments` for image storage, `PUT /rest/atm/1.0/testcase/{testCaseKey}` for the rich-text script, and full-case read-back. The published RAML, `testcase_get.example`, `testcase_put.example`, `attachment_response_id.example`, and `attachments_get.example` define these mappings. Rich-text HTML image rendering must also be checked on the target installation; do not treat public endpoint support alone as proof of display.

- Read the complete case first. Use the exact `testScript.steps[].index`; the official case example starts at `0`, while the displayed step number may start at `1`.
- `zephyr_get_test_case_attachments` reads case-level source files; optional `stepIndex` reads native step attachments instead. Full-case reads alone do not prove either attachment inventory was read.
- `zephyr_add_session_step_image` accepts `confirmed: true`, `testCaseKey`, exact `stepIndex`, current `_testdocs.contentHash` as `expectedContentHash`, absolute local `imagePath`, `targetField` (`description` or `expectedResult`), `caption`, optional `filename` and `thumbnailWidth` (120-480 pixels, default 320). The inspected image may contain separately saved arrow/rectangle annotations under the image rules. PNG/JPEG/GIF/WebP up to 25 MiB are accepted; a deployment may impose a lower limit.
- The upload requires explicit publication-with-images or correction intent, creation earlier in this chat, and the running MCP creation registry. No installer opt-in is needed. Case creation is followed by complete read and selected preview insertions. A later failure does not erase the case; report its key and individual outcomes.
- Preflight checks the hash, exact step, source image type, and complete script shape. It stops before mutation for unsupported fields/called steps or native step attachments whose preservation during script replacement is unverified. The image is uploaded as multipart field `file`, then ID, filename, size and URL are checked through the case attachment inventory. Case-level storage supports the inline preview; it is not the finished placement.
- Before the script write, re-read the case and compare the script. Preserve all existing step text, order, test data and documented step IDs. Append an escaped HTML `a`/`img` fragment under the selected cell text, with the returned attachment URL, caption as alt text, bounded width and proportional height. Write only the complete `testScript`; never normalize other existing rich text or update unrelated fields.
- A `preview_saved` outcome confirms read-back of the exact preview markup in the intended cell and preservation of the other script text. `displayVerified: false` means visual verification remains: inspect the miniature, its proportions, correct column and opening of the original. If the editor strips the image/size or display is unavailable, report the gap; do not claim the requested visual result is complete.
- Duplicate filenames are rejected. Partial outcomes preserve the known ID/URL and distinguish uncertain upload, source upload without preview, and uncertain script write. Inspect the case inventory and current cell before retrying; do not repeat mutations automatically or recreate the case.
- This tool adds previews. Replacing/removing an existing inline preview requires the complete image diff and a permitted current-session script correction, preserving unrelated text and image markup. Removing a preview does not authorize deletion of its stored file; native attachment replacement/removal is not exposed here. Do not use private deletion endpoints or script replacement to simulate native attachment removal.

Do not apply this Server/DC mapping to Cloud or another TMS. Discover the selected connection's actual upload and inline-thumbnail capabilities. If only attachments/links are available, keep the prepared image and placement proposal for manual insertion instead of claiming the request was fulfilled.
