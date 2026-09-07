# Elastic / Kibana MCP capability profile

Use Elastic/Kibana only when logs or observability evidence materially affects the current test. Prefer the current Elastic Agent Builder MCP endpoint when the deployment supports it:

```text
{KIBANA_URL}/api/agent_builder/mcp
{KIBANA_URL}/s/{SPACE_NAME}/api/agent_builder/mcp
```

Official documentation:

- <https://www.elastic.co/docs/explore-analyze/ai-features/agent-builder/mcp-server>
- <https://www.elastic.co/docs/api/doc/kibana/authentication>

## Compatibility and authentication

- Confirm the Elastic deployment/version and whether Agent Builder MCP is enabled before configuration.
- API-key authentication is supported for Elastic Stack and Serverless; OAuth 2.1 is currently deployment-dependent. Do not assume the browser's SSO/Keycloak session can authenticate an MCP/API client.
- Prefer a short-lived, read-only key restricted to the necessary spaces and indices. Keep keys outside the repository and pass them through a private environment/header mechanism supported by the client.
- If the current deployment cannot expose Agent Builder MCP, an approved Elasticsearch/Kibana read API or a time-bounded export is a valid fallback.

## QA read contract

- Start from the tested environment, exact time interval and a service, trace, correlation or request ID when available.
- Query only relevant log indices and fields. Do not perform broad searches across unrelated projects or users.
- Preserve the query, time zone, interval, environment and a direct observability link when available.
- Quote only the smallest relevant log fragment. Mask tokens, cookies, authorization data, personal data and unrelated payload fields.
- Logs support an observation or diagnosis; they do not replace the user-visible/API expected result.

Do not create alerts, connectors, rules, dashboards, indices or saved searches unless the user explicitly requests that separate write.
