# Legacy Test Management for Jira capability profile

Use this profile for installations identified as **Test Management for Jira**, including version `6.9.0`, or another legacy TM4J deployment.

TM4J is the earlier product name in the Zephyr Scale product line. Product lineage does not guarantee that a legacy Server or Data Center installation exposes the same fields, endpoints, authentication, or version behavior as a modern Zephyr Scale Cloud connection.

## Onboarding facts to capture

```text
Exact marketplace application name:
Application version:
Jira deployment and version: Server | Data Center
How test cases are stored: Jira issue | vendor test object | unknown
MCP server name and version:
Available test-case read tools:
Available relation and search tools:
Available write tools:
Version-history and comment support:
Reusable or called-step support:
```

Do not guess an answer from the UI resemblance to Zephyr Scale.

## Minimum read proof

The adapter is TMS-capable only after it can retrieve one approved demonstration case with:

- stable identifier;
- current name and version when available;
- preconditions;
- ordered steps;
- step-level expected results;
- raw lifecycle, priority, folder, and link fields when available.

If the MCP server can read only Jira issues and Confluence pages, classify TMS read as `CAPABILITY_UNAVAILABLE`. Continue with issue-based generation or request a TMS export; do not claim that existing cases were checked.

## Neutral mapping

Map retrieved content to `rules/integration-rules.md`. Preserve all unsupported or differently named fields as explicit gaps. Do not send modern Zephyr Scale Cloud requests to a legacy installation unless the company-provided MCP adapter explicitly implements that compatibility.

The bundled Jira MCP implements read compatibility for installations that expose `GET /rest/atm/1.0/testcase/{key}`. A successful response includes the current case and its `testScript.steps`; the adapter sorts those steps by `index`. This must still be verified with one approved demonstration case during onboarding because endpoint presence and field completeness vary by installation.

## Writes

Keep legacy write tools approval-gated. Before publishing, confirm whether the product requires a new version, a direct edit, a Jira issue transition, a plugin status change, or a separate relation operation. Never infer that workflow from the modern profile.
