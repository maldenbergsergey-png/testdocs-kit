# QA Tools / ТестОпс capability profile

Use this profile when setup selects **QA Tools (ТестОпс)** as the TMS.

QA Tools provides its own Streamable HTTP MCP endpoint at `<instance>/api/mcp`. The bundled `testdocs_qa_tools` STDIO proxy keeps the API token out of AI-client configuration, forwards the vendor's `testops_*` tools, and applies Testdocs Kit write boundaries.

## Authentication

Setup supports a personal API token or a local QA Tools username and password. With an API token, the proxy sends it only to the configured instance as:

```text
Authorization: Api-Token <API token>
```

If an older or differently configured instance rejects that header with `401` or `403`, the proxy performs the vendor-documented API-token exchange at `/api/uaa/oauth/token` and retries once with the returned short-lived Bearer token. If both variants are forbidden, treat this as an instance permission, license, or MCP enablement problem rather than retrying credentials indefinitely.

The token acts with its owner's project permissions. Keep it outside prompts, examples, logs, and committed configuration.

In username/password mode, the proxy requests a short-lived Bearer token from `/api/uaa/oauth/token` with the standard URL-encoded `grant_type=password` form and sends only that Bearer token to MCP. Some instances can disable password grant even though interactive local login is available; in that case use a personal API token, which is the vendor-documented MCP mode. Login and password remain only in the private Testdocs Kit config.

## Tool exposure

- `testops_find_*`, `testops_get_*`, and `testops_list_*` tools are available for scoped reads.
- Other vendor tools are hidden unless changing operations were separately enabled during setup.
- Every exposed changing tool receives a required local `confirmed: true` guard; the proxy strips that field before forwarding the vendor payload.
- Tools whose names contain `delete` or `remove` are never exposed, even when writes are enabled.

Tool schemas come from the connected QA Tools instance, so the adapter follows the installed product version instead of hard-coding unstable REST endpoints. Preserve stable identifiers and raw fields, then map retrieved content through `rules/integration-rules.md`.

## Direct test-case links

Treat a UI link such as `https://qa-tools.company.example/project/3/test-cases/5392` as an explicit TMS reference. Parse the project and test-case identifiers from the path, then call `testops_find_testcases` with that exact scope according to its live schema. The browser page itself requires JavaScript and is not the integration endpoint; do not route this link through generic WebFetch when `testdocs_qa_tools` is connected.

Official references: [MCP connection](https://docs.qatools.ru/ecosystem/mcp/setup/), [MCP tools](https://docs.qatools.ru/ecosystem/mcp/tools/).
