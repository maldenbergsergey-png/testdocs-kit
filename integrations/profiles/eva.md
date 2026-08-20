# EvaProject and EvaWiki profile

Eva is configured as one logical connection when EvaProject and EvaWiki belong to the same Eva instance. Store one instance base URL and one API token outside the repository. Do not ask for a second documentation URL unless the organization's approved adapter explicitly requires it.

## Required profile

```text
Connection ID: local neutral identifier
Eva instance base URL: https://eva.example.invalid
Authentication: API token
MCP command: evateamclient-mcp or an organization-approved compatible command
Allowed capabilities: explicit read-only allowlist
```

The bundled adapter expects `EVA_API_URL` and `EVA_API_TOKEN` and forwards them only to the local Eva MCP process. Client configuration contains only the Testdocs Kit launcher command.

## Capability mapping

| Neutral need | Eva source |
| --- | --- |
| Task and project context | EvaProject tasks, projects, epics, links, history, sprints, releases |
| Discussion context | Task comments |
| Requirement and knowledge context | EvaWiki documents and page tree |
| People and taxonomy | Persons, task types, tags |

Read capabilities must be verified separately. Sharing one instance and token does not mean every user can read every project or document.

## Safety boundary

The bundled proxy exposes only approved read tools. Create, update, archive, and delete tools from an upstream Eva MCP are hidden. Jira bug creation rules must not be reused for Eva: creating an Eva defect remains unavailable until an adapter can inspect the target project's live form and custom-field requirements safely.

If the company supplies a different Eva MCP, keep the same neutral context and safety contract. Validate its actual tool names and authentication variables before enabling it; never put the token in a shared command, skill, repository file, or AI-client configuration.
