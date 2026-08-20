# EvaProject and EvaWiki profile

Eva is configured as one logical connection when EvaProject and EvaWiki belong to the same Eva instance. Store one instance base URL and one API token outside the repository. Do not ask for a second documentation URL unless the organization's approved adapter explicitly requires it.

## Required profile

```text
Connection ID: local neutral identifier
Eva instance base URL: https://eva.example.invalid
Authentication: API token
Adapter: bundled Testdocs Kit read-only MCP
Allowed capabilities: explicit read-only allowlist
```

The bundled adapter expects `EVA_API_URL` and `EVA_API_TOKEN` internally. The installer supplies both from the private Testdocs Kit configuration; client configuration contains only the Testdocs Kit launcher command. Testers do not install a separate Eva binary or Go runtime.

## Capability mapping

| Neutral need | Eva source |
| --- | --- |
| Task and project context | EvaProject tasks and projects |
| Discussion context | Task comments |
| Requirement and knowledge context | EvaWiki documents and page tree |

Read capabilities must be verified separately. Sharing one instance and token does not mean every user can read every project or document.

## Safety boundary

The bundled MCP implements only approved read tools. Create, update, archive, and delete tools are absent. Jira bug creation rules must not be reused for Eva: creating an Eva defect remains unavailable until an adapter can inspect the target project's live form and custom-field requirements safely.

If the company later supplies a different Eva MCP, keep the same neutral context and safety contract. Validate its actual tool names and authentication variables before enabling it; never put the token in a shared command, skill, repository file, or AI-client configuration.
