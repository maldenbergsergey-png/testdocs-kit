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

Follow [external write rules](../../rules/external-write-rules.md) and the [temporary update restriction](../../rules/update-rules.md). After installer opt-in, the bundled adapter exposes creation and registry-guarded correction of cases created by the current MCP process. Other case updates remain proposal-only, regardless of baseline fingerprints. Use the field mapping below for supported operations.

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

Do not hard-code one Cloud, Server, or Data Center API schema into the QA skills. Record deployment and product version in the connection profile, then adapt the MCP tool output to `rules/integration-rules.md`.

The bundled Jira MCP reads a complete Server/Data Center or compatible TM4J case through `/rest/atm/1.0/testcase/{key}` when available. It orders `testScript.steps` by `index`. When that endpoint is unavailable, it falls back internally to search and returns `_testdocs.complete: false`; do not treat that metadata-only response as evidence that the steps were checked. Search accepts a project key for the compatible `/rest/atm/1.0/testcase/search` endpoint and can recover a supported endpoint internally, reducing repeated client-visible failures.

For creation, the bundled adapter uses the public Server/Data Center `POST /rest/atm/1.0/testcase` contract with a `STEP_BY_STEP` script. It maps each Markdown row to separate `description`, optional `testData`, and `expectedResult` fields, and converts `[label](https://...)` in rich-text values into clickable Zephyr links. The target folder must already exist; the adapter does not create or move folders. Complete case reads return `_testdocs.contentHash`; metadata-only fallback does not. Case reads, creation, and permitted updates return `_testdocs.webUrl` when a stable key is available.
