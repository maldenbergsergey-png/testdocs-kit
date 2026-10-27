# Source reading priority

Apply to Jira, Confluence and knowledge-source reads. Reuse complete current context first. An explicit user choice of browser selects that read route; API-only metadata or write preflight still needs its required structured capability.

## Choose the route

1. Resolve the matching issue/knowledge MCP from the supplied full URL. Preserve that URL when the tool accepts it. If a relay is configured for this connection, its adapter tries relay reading first and any permitted original-connection reserve under the [relay profile](../integrations/profiles/read-relay.md) inside one call.
2. Without a configured relay, use the original MCP directly. Do not probe, configure or request a key for an assistant merely because that transport exists in the pack. The relay reserve conditions remain network/timeouts/5xx, without a new login.
3. If structured reading is unavailable, including a missing connector or an expired connector session, use an already accessible matching browser session as the last read route under [session reuse](browser-session-rules.md). Do not start another profile, login or 2FA merely for this reserve. If the source content is still inaccessible, state the exact gap and continue independent work. A confirmed resource-permission denial must not be bypassed.

Do not add another API/connector workaround, scrape metadata as requirements or try unrelated instances. Writes retain their separate contracts and never acquire a browser write route from this read priority.

## Avoid repeated recovery and false verification

- Use available local connector diagnostics once after a relevant failure or for an explicit connection test; do not probe every connection before each read. If the running connector reports the original route after the user configured a relay, identify a stale/mismatched process and the exact MCP to restart. Readable browser content can still satisfy an ordinary source request, but does not prove the relay is working.
- Distinguish configured and observed transport. Prefer the current response's `readTransport`; use `lastIssueRead` only when it corresponds to that operation. Otherwise report the actual channel as unverified. Identify browser reading as browser reading, never adapter reserve or successful API verification.
- Reuse complete retrieved text and the working scoped browser session for follow-ups instead of retrying failed routes or refetching unchanged sources. A necessary API-only operation that the browser cannot supply follows the exact connector recovery under [session rules](browser-session-rules.md#recover-only-the-access-needed).
