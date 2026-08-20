# Connect company QA systems to Codex through MCP

This is a reusable onboarding guide for testers. Replace placeholders only with values supplied by the company's Jira, Confluence, Eva, TMS, or MCP administrator. Never commit credentials or paste them into a test-case prompt.

For the bundled Testdocs Kit installer, prefer the automated commands from the root README. They preserve the private settings file, allow more than one Jira/Confluence/Eva connection, and keep previous answers when Enter is pressed. The manual procedure below is for company-provided MCP servers or clients not handled by the installer.

Current Codex MCP configuration behavior is documented in the [official OpenAI MCP guide](https://developers.openai.com/codex/mcp/).

## 1. Obtain the connection profile

Ask the company administrator for:

```text
Connection name:
Company / environment:
Transport: STDIO | Streamable HTTP
Approved command and arguments, or server URL:
Authentication: OAuth | bearer-token environment variable | local environment variables
Required environment-variable names, without secret values:
Jira base URL and project scope:
Confluence base URL and space scope:
Eva base URL and project/document scope, when used:
TMS product, version, and deployment: Cloud | Server | Data Center
Allowed read capabilities:
Allowed write capabilities:
Known tool names or capability documentation:
Support contact:
```

Prepare one profile for each independent connection. Jira and Confluence may share a host or use different hosts; do not infer one URL from the other. EvaProject and EvaWiki normally use one Eva connection and token unless the approved adapter states otherwise. A tracker/knowledge server and a TMS server may be configured independently; the QA skills combine their evidence through the neutral context bundle.

For an already configured Testdocs Kit installation:

```bash
npm run update
npm run reconfigure
npm run configure:jira
npm run configure:eva
npm run configure:tms
npm run add:jira
```

Use `npm run update` to pull and apply new instructions without repeating setup. Use a `configure:*` command to change one area and an `add:*` command to retain existing connections while adding another.

## 2. Add the MCP server

### ChatGPT desktop app

1. Open **Settings** → **MCP servers**.
2. Select **Add server**.
3. Enter the approved name, choose **STDIO** or **Streamable HTTP**, and enter the approved command or URL.
4. Save and restart.
5. If OAuth is shown, select **Authenticate** and complete the company sign-in.
6. Enter `/mcp` in the composer and confirm that the server is connected.

### Codex IDE extension

Open the gear menu → **MCP servers** → **Add server**, enter the same connection profile, save, and restart the extension. Authenticate when requested.

### Codex CLI

For a company-approved STDIO command:

```text
codex mcp add <connection-name> -- <approved-command> <approved-arguments>
```

Then verify configuration with:

```text
codex mcp list
codex mcp --help
```

For OAuth-enabled servers:

```text
codex mcp login <connection-name>
```

Do not place a bearer token directly in a shared command, document, repository, or shell history. Use the approved environment-variable or OAuth flow.

## 3. Optional project-scoped configuration

Codex can read user-level MCP configuration from `~/.codex/config.toml` or project-scoped configuration from `.codex/config.toml` in a trusted project. The desktop app, CLI, and IDE extension share the configuration for the same Codex host.

Streamable HTTP with OAuth:

```toml
[mcp_servers.company_qa]
url = "https://mcp.example.invalid/mcp"
auth = "oauth"
enabled = true
required = false
default_tools_approval_mode = "writes"
```

Streamable HTTP with a token stored in an environment variable:

```toml
[mcp_servers.company_qa]
url = "https://mcp.example.invalid/mcp"
bearer_token_env_var = "COMPANY_QA_MCP_TOKEN"
enabled = true
required = false
default_tools_approval_mode = "writes"
```

STDIO with secret values forwarded from the environment:

```toml
[mcp_servers.company_qa]
command = "<approved-command>"
args = ["<approved-argument>"]
env_vars = ["COMPANY_JIRA_TOKEN"]
enabled = true
required = false
default_tools_approval_mode = "writes"
```

Use `enabled_tools` only after the administrator supplies the server's exact tool names. Prefer a read-only allowlist for ordinary analysis. Keep write approvals enabled.

## 4. Verify capabilities safely

Use company-approved demonstration records. Do not test write access against production data.

| Check | Safe verification | Result |
| --- | --- | --- |
| Issue read | Read one known non-sensitive Jira issue | PASS / FAIL / NOT AVAILABLE |
| Issue relations | List its approved links or parent | PASS / FAIL / NOT AVAILABLE |
| Knowledge read | Read one known Confluence page | PASS / FAIL / NOT AVAILABLE |
| TMS read | Read one known test case with steps | PASS / FAIL / NOT AVAILABLE |
| Issue-to-case relation | Find cases linked to the demonstration issue | PASS / FAIL / NOT AVAILABLE |
| TMS write | Confirm that write tools are approval-gated; do not execute | GATED / NOT AVAILABLE / UNSAFE |

Record `PERMISSION_DENIED` separately from `NOT_FOUND`. If Jira works but TMS read is unavailable, the connection is still usable for issue-based generation but not for checking existing coverage.

## 5. Use the QA skills

Issue-anchored generation:

```text
Use $collect-test-context for ISSUE-123, then use $generate-test-cases.
Show the proposed cases in chat. Do not publish them.
```

Actualization analysis:

```text
Use $collect-test-context for ISSUE-123 and check whether linked test cases need actualization.
Show CREATE, UPDATE, NO_CHANGE, or INSUFFICIENT_CONTEXT decisions. Do not change the TMS.
```

Manual context without Jira:

```text
Use $generate-test-cases from the requirements pasted below. No Jira issue is supplied.
```

Reviewed publication:

```text
Publish only the reviewed cases listed below to <target project and TMS> and link them to ISSUE-123.
Show the exact planned operations before writing.
```

Direct new-case creation:

```text
Generate and create the new cases in <target project>, existing folder <folder>. Do not modify existing cases.
```

Generation, analysis, and review do not imply publication. Explicit `create` or `publish` wording is always required, but it may be included in the original request. The bundled adapter keeps updates and destructive operations unavailable.

## Troubleshooting handoff

When onboarding fails, send the administrator:

```text
Codex client: desktop | CLI | IDE
Connection name:
Transport:
Server status from /mcp or codex mcp list:
Authentication state:
Failed capability:
Error category: NOT_FOUND | PERMISSION_DENIED | CAPABILITY_UNAVAILABLE | CONNECTION_FAILED
Secret-free error text:
```
