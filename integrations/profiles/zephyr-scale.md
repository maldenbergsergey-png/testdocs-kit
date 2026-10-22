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

The bundled Server/DC adapter uses the official public `POST /rest/atm/1.0/testrun` operation with the complete `items` list. Each item carries its test-case key and resolved Jira `userKey`; release tasks are supplied in `issueLinks`. Case composition cannot be updated through the public API, so preflight the full deduplicated set before creation. Item assignment can be corrected through the documented Test Result `assignedTo` field: the adapter does so only after a read-back mismatch, once per affected item, and verifies again. Do not create an empty run, add or remove cases later, or delete/recreate a run automatically.

Do not treat test-case creation capability as Test Run capability. Resolve testers through Jira assignable-user search and use the connector-returned user key rather than a display name or email address.

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
