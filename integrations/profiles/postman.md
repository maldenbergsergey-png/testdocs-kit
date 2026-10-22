# Postman MCP capability profile

Use Postman for explicitly scoped API specifications, workspaces, collections, requests, examples, mocks and monitors. The official remote MCP supports OAuth in the US region and API-key authentication where required.

Official documentation:

- <https://learning.postman.com/docs/reference/postman-api/postman-mcp-server/overview/>
- <https://learning.postman.com/latest-v-12/docs/reference/postman-api/postman-mcp-server/postman-mcp-remote-server>

## Endpoints

| Mode | US | EU |
| --- | --- | --- |
| Minimal | `https://mcp.postman.com/minimal` | `https://mcp.eu.postman.com/minimal` |
| Code | `https://mcp.postman.com/code` | `https://mcp.eu.postman.com/code` |
| Full | `https://mcp.postman.com/mcp` | `https://mcp.eu.postman.com/mcp` |
| Learn | `https://mcp.postman.com/learn` | `https://mcp.eu.postman.com/learn` |

Use Minimal for ordinary discovery and Full only when collection/specification/mock/monitor management capabilities are actually needed. Do not load multiple modes for the same task.

## QA contract

- Read only the workspace, collection, specification or request placed in scope.
- A saved Postman example or collection documents an intended request but is not proof that it was executed against the current environment.
- When executing API checks, record the actual target environment, sanitized variables, status and relevant response. Never expose secrets inherited from a Postman environment.
- Creating a collection from observed requests can be useful after testing, but creation/update is an external write. Perform it only when the user explicitly asks to create or save the collection.
- Do not run monitors or mutating requests against an unspecified or production environment.

## Authentication and fallback

Prefer OAuth where the selected endpoint and client support it. For an API key, keep the key outside the repository and client snippets; reference it through an environment variable. If Postman is unavailable during requested API execution, use an available HTTP/terminal tool and save sanitized request/response evidence locally when needed. For collection maintenance, use a supplied export/local file instead; maintenance alone does not authorize live requests.

## Collection maintenance capabilities

For a Git-backed collection use its [repository binding](git-repositories.md) and actual local files. Each tester can use their own Postman account; Git publication and Postman Cloud synchronization are different operations. MCP is not required for local Git edits or Git push/pull.

When asked to connect Postman, run `npm run configure:postman` in the installed pack. It uses a personal account, browser OAuth and Full collection-management tools at `https://mcp.postman.com/mcp`, without region/tool/key questions. It preserves repository/GitLab/CA bindings and other providers, and scopes OAuth login to Postman. Authenticate each selected client independently: `codex mcp login testdocs_postman` and/or `opencode mcp auth testdocs_postman` (`opencode2` for V2). One client's failed login does not block the next; a successful login is not transferred to another client. Restart the client after completion. For a nondefault region or tool set, explicitly use `npm run configure:postman -- --advanced-postman`.

Use `npm run configure:postman-repository` once for the independent Git collection binding; reuse an existing enabled binding instead of requesting the URL again. For the requested collection update, follow the [agent Git workflow](git-repositories.md#agent-git-workflow) to refresh/read the intended revision, patch local files and publish to the bound remote when task intent and saved push opt-in permit it. Open the local checkout in Postman to view/run the collection. Cloud synchronization is optional and separate; completing OAuth alone does not synchronize Git files.

For request/schema updates, use [update-postman-collection](../../skills/update-postman-collection/SKILL.md) and its [shared rules](../../rules/postman-collection-rules.md). File-based input/output remains available without a connection; an HTTP run is not a substitute for reading the collection baseline.

Inspect the exposed inventory for full nested collection reads, inherited scripts/auth/variables, stable item IDs, folder/item creation and updates, and post-write reads. Minimal discovery need not expose these writes; select Full when required. Confirm whether an update patches an item or replaces a whole collection; map the desired payload to that exact operation. Do not assume conditional revisions, fork creation, JavaScript execution or monitor controls exist.

Preserve workspace/collection/item IDs, server revision/ETag when supplied, sanitized baseline hash, desired diff and write receipts. Follow read-before-write, conflict handling and uncertain-outcome reconciliation from the shared rules. Use sanitized collection exports/local files as the baseline when live reads are unavailable; never claim that a local patch was saved to Postman.

Remote MCP accesses server-side assets. For [Native Git](https://learning.postman.com/docs/use/native-git/overview/), verify whether the intended element is local or cloud-synced and use the matching access path. See the [setup and automation guide](../postman-collection-sync.md) for optional bindings and host-driven invocations.

## Runner and credential transport

For ordering, variable handoff, auth modes and restricted methods, apply [workflow rules](../../rules/postman-workflow-rules.md). Read actual item/folder order and route scripts; verify the selected runner supports the planned skip/stop/routing behavior. A thrown pre-request error is not a reliable send guard.

- [Request workflows](https://learning.postman.com/docs/tests-and-scripts/running-collections/building-workflows/): pm.execution.setNextRequest affects collection runs, not individual Send. Prefer item IDs; a folder run cannot route outside that folder. Do not assume the selected MCP exposes runner or saved run-selection editing.
- [Variable scopes](https://learning.postman.com/docs/use/send-requests/variables/variables/): global, collection, environment, data and local values have increasing precedence. Inspect scope-specific reads/writes and effective resolution; do not expose values while checking bindings.
- [Authorization](https://learning.postman.com/docs/use/send-requests/authorization/specifying-authorization-details/): preserve parent inheritance and request overrides. Runtime token/cookie references can be configured without an API login method; MCP OAuth/API-key credentials are separate.
- [Cookie scripting](https://learning.postman.com/docs/tests-and-scripts/write-scripts/postman-sandbox-reference/pm-cookies/): jar access needs permitted domains and asynchronous completion. Confirm runner/client support and cookie-header/jar behavior before relying on it. Never assume browser cookies are available to the MCP runner.
