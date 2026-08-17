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

Treat create, update, new-version, issue-link, comment, status-change, folder-move, and called-step changes as separate operations. The bundled adapter exposes new-case creation and one narrow correction for a key created by the same running MCP process; both require an explicit user request that identifies the exact target and content. Previously existing, discovered, and prior-session cases remain read-only. Keep every other update and destructive operation unavailable.

## Compatibility

Do not hard-code one Cloud, Server, or Data Center API schema into the QA skills. Record deployment and product version in the connection profile, then adapt the MCP tool output to `rules/integration-rules.md`.

The bundled Jira MCP reads a complete Server/Data Center or compatible TM4J case through `/rest/atm/1.0/testcase/{key}` when available. It orders `testScript.steps` by `index`. When that endpoint is unavailable, it falls back internally to search and returns `_testdocs.complete: false`; do not treat that metadata-only response as evidence that the steps were checked. Search accepts a project key for the compatible `/rest/atm/1.0/testcase/search` endpoint and can recover a supported endpoint internally, reducing repeated client-visible failures.

For creation, the bundled adapter uses the public Server/Data Center `POST /rest/atm/1.0/testcase` contract with a `STEP_BY_STEP` script. It maps each Markdown row to separate `description`, optional `testData`, and `expectedResult` fields. The target folder must already exist; the adapter does not create or move folders. Case reads, creation, and the permitted current-session correction return `_testdocs.webUrl` using the configured URL template when a stable key is available.
