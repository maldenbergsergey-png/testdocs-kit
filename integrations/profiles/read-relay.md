# Optional read relay

Load only when a connection reports that its ordinary reads use a relay. This transport is configured explicitly outside the standard setup wizard; ordinary token and password connections keep their existing behavior.

## Explicit local setup

Run from the installed kit, only when the user requests deployment/configuration:

```sh
node scripts/configure-read-relay.mjs
node scripts/configure-read-relay.mjs --show
node scripts/configure-read-relay.mjs --check
```

The separate wizard selects existing Jira/Confluence connection IDs and their exact relay API base URLs. One pasted key can bind only endpoints of the same relay origin; configure different gateways separately. It accepts the key through hidden terminal input, then saves it in an owner-only credential file outside repositories. The separate private `read-relays.json` holds file references, canonical source URLs, optional project-key mappings and an optional same-origin knowledge-search URL. Never pass a key as a command argument, in chat, an answers file, or AI-client configuration. No manual credential filename is required. Configuration itself makes no network requests; `--check` reads current-user endpoints and never tests a write.

Company hosts and project mappings are private runtime values, not installer defaults or shared examples. This optional command is absent from the standard wizard, help and npm command list. That reduces incidental disclosure; it does not make the source code an access-control mechanism. Normal setup/update must preserve the sidecar and credential files. Restart affected MCP servers after changing route settings; the key file is read for every relay request so an in-place key rotation needs no adapter restart.

## Fixed operation routing

| Operation | Transport |
| --- | --- |
| Ordinary Jira issue read, history, transitions and JQL search | Configured Jira read relay; GET search |
| Confluence page, hierarchy and CQL search | Configured Confluence read relay |
| Semantic knowledge discovery, when configured | Exact same-origin knowledge endpoint; POST question/top_k |
| Jira create metadata/current user, requested creation, attachments and verification of a just-created issue | Original Jira connection |
| Zephyr reads, creation and registry-guarded session correction | Original Jira/TMS connection |

These routes are selected inside the adapter. The model cannot change the read transport with a tool argument. The separate wizard explicitly selects the reserve policy: `none`, or `transient` for network/timeouts and HTTP 5xx. New setup suggests `transient`; existing bindings without a policy keep `none`. A permitted reserve makes one read of the same resource through the exact original connection and reports `original_fallback` in the result. It never selects another company, starts a browser login, bootstraps a password session or retries a write. An expired or missing original session stops the reserve read. Do not add fallback outside the adapter or use metadata tools as a substitute for ordinary source retrieval.

Relay 401/403, missing/private-key errors, invalid configuration/JSON, redirects, 404 and 429 do not trigger reserve reads. Semantic knowledge search has no equivalent original endpoint and never uses fallback. Reauthentication of the original connection does not repair relay access. Writes retain their existing opt-in, user-intent and case-registry boundaries. A relay's read-only key grants no write permission; an original write/read reserve channel must be separately available and authorized.

Jira source links retain their canonical instance. When optional routing is enabled, a full issue URL identifies the instance before any HTTP request; a key-only reference needs a unique configured project mapping, or a single configured Jira. A wrong-instance call or ambiguous key stops before probing either company. Search still requires the intended instance to have been resolved from scoped context; JQL alone is not a universal company identifier. Do not infer a company from results of speculative searches. Confluence numeric IDs likewise require a resolved instance.

Create metadata and writes use the original connection's live schema/user. A key returned by issue creation is registered in that MCP process; `get_issue` for that exact just-created key uses the original connection for immediate read-back. Other reads keep using the relay. After a process restart this verification registry is gone; do not claim immediate original-channel verification from a relay response. TMS source cases retain their separate current-chat creation registry.

The original session is reused and updated from server cookies, but its expiry and MFA requirements remain server-controlled. Relay reads do not refresh the original write session. TLS verification is required for both transports. Semantic hits are discovery excerpts; retrieve scoped full source pages before treating them as complete requirements. A Jira relay does not establish Zephyr capabilities.
