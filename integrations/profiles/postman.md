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

Prefer OAuth where the selected endpoint and client support it. For an API key, keep the key outside the repository and client snippets; reference it through an environment variable. If Postman is unavailable, run safe requests with an available HTTP/terminal tool and save sanitized request/response evidence locally when needed.
