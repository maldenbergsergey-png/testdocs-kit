# Postman request dependencies and access prerequisites

Apply with [collection maintenance rules](postman-collection-rules.md) when inserting/reordering requests, maintaining variables/authentication, or handling methods with execution restrictions. Use actual collection scripts and supplied contracts; no project-specific login route, variable name or folder layout is a portable default.

## Dependency-aware insertion

Map the affected chain from the current collection and supplied requirements: producer request ID and response field/header/cookie, extraction/initialization script, variable name and write scope, consumer read location and effective scope, plus cleanup or invalidation. Include inherited scripts, request-body/URL/auth references, data-file inputs and explicit next-request routing. A matching variable name or a request's title alone is not enough to invent a producer or its extraction path.

Insert a new request in the best existing section after every necessary data/auth producer and before its consumers or the cleanup that invalidates its inputs. Preserve the relative order of independent existing items. For a necessary existing-item move, use the smallest justified edit under the preservation rules. Do not duplicate an old setup method or rebuild the tree to make a new method fit. If a missing producer, cycle or conflicting folder/run boundary prevents a sound sequence, complete independent schema edits and identify the unresolved dependency; do not invent resource IDs or claim the chain is runnable.

Validate effective execution order, not just visual placement: folder traversal, inherited scripts and explicit next-request branches can override it. A selected folder/subset run must include the prerequisite closure, or have explicitly supplied valid inputs replacing those prerequisites. A full collection's working order does not prove that an isolated method or folder will work. When setup is outside the selected folder, give the required full/selected run sequence or an appropriate existing workflow entry point; do not silently move folders or promise a jump outside the runner's scope. A runner recipe is not creation of a TMS Test Run.

When routing really needs changing, preserve existing branches and use stable request IDs with supported runner capabilities. Inspect every affected incoming/outgoing route so a new request is reachable and cleanup still runs after its last consumer. Do not introduce loops or retries merely to obtain variables. Do not add routing when insertion in the existing sequence suffices.

## Variable handoff and failure handling

Write response-derived values only after the producer's supported success status and required response shape have been checked. Use the real extraction path; do not choose the first array element or a similarly named response field without evidence. Ensure the write completes before the consumer sends. Serialize/parse non-scalar values using the established format.

Match each write with the effective read, including environment/collection/global/local/data scopes and shadowing. An environment or iteration value can mask a newly written collection/global value. Correct only the affected binding or report the conflict; do not clear unrelated scopes or user credentials. Use an appropriately narrow existing scope, while supporting a user-selected global binding when required. A value generated in another environment, previous iteration or failed producer is not valid setup by default.

For flow-owned derived variables, invalidate stale values/readiness at the appropriate run/iteration or failed-producer boundary; retain persistent external inputs according to their supplied lifecycle. On missing auth/data or failed extraction, make the prerequisite failure visible and prevent dependent requests from sending unresolved placeholders or stale IDs. Use a supported skip/stop mechanism only for that dependent chain and keep independent checks available. A script assertion/throw alone must not be assumed to prevent sending or to stop the runner. Preserve cleanup for resources actually created in this run, without acting on stale/unrelated IDs. These prerequisite checks must not block intentionally invalid inputs or unauthenticated variants used by negative tests.

Verify handoff with an offline trace/isolated fixtures when possible: successful producer to consumer, absent/malformed extraction, producer failure with stale input, scope shadowing, and the intended folder/subset/iteration order. Distinguish this verification from live execution. If scripts or runner capabilities are unavailable, keep the runnable-readiness limitation explicit.

## Authentication modes

Choose per relevant request/flow from supplied contracts, current setup and user-provided bindings. API authentication and authentication to the Postman/GitLab MCP servers are independent.

- **Acquired credentials:** reuse a documented authentication/bootstrap/refresh method when present. Put it before protected consumers, validate the supported response and extract token/cookie into the intended scope. Preserve its actual initialization and renewal policy; do not invent a login method, token field or retry/refresh loop.
- **External credentials:** accept a token, cookie or session value supplied through the selected runtime variable/secret mechanism when no authentication method exists or this is the chosen mode. Bind the existing variable to the documented auth/header/cookie location, with an input prerequisite explaining name, scope and value format but no secret value. This is a supported workflow; an absent login endpoint does not block collection maintenance or require creating one.

Keep collection/folder auth inheritance and per-request overrides, including intentionally unauthenticated/negative requests. Do not attach credentials indiscriminately to public methods or unrelated hosts. Resolve whether a token variable stores a raw token or a prefixed header, and avoid duplicate Authorization headers/Bearer prefixes. For cookies, use the established Cookie-header or cookie-jar route; account for domain/path/security/expiry and supported jar access. Do not send the same cookie twice or assume any browser, remote runner and local Postman share a jar.

Secret values remain in the user's private runtime/secret storage. Collection patches, examples, exports, receipts and logs contain references and masked prerequisite states, not token/cookie/password values. Do not ask for secrets in chat just to prepare a patch, write them into this pack/client config, publish shared secret values, log extracted credentials or copy them to broader scopes without the user's explicit scope choice. A global binding may be supported without assigning an actual secret during skill development or maintenance drafting.

## Restricted methods stay in scope

Include every in-scope method in the collection and method inventory even when authentication prerequisites, anti-bot/WAF challenges, allowlists, rate limits or manual setup make it unsuitable for an unattended run. Keep it in its suitable section and dependency chain; record a concise execution prerequisite/limitation in the existing description or supported metadata. Prepare its normal contract assertions from the source. Distinguish included coverage, automation readiness and actual execution.

Do not delete/omit the method, copy a protection page into its success schema, accept an unexpected 403/429/HTML challenge as a passing contract, or disable assertions to obtain a green run. A restriction needs supplied or observed evidence; an arbitrary error is not proof of anti-bot protection. With a known unsatisfied prerequisite, report the limitation and use the runner's supported dependent-request handling rather than repeated blind attempts. Keep dependent consumers visibly unavailable if the restricted producer cannot supply their data, and continue independent checks. Preserve intentionally specified access-denial tests as separate valid scenarios.

Collection maintenance does not require solving a challenge or bypassing the restriction. Use an approved test setup or supplied session when available; a ready patch can still be delivered with its remaining execution condition. Never claim that an unexecuted restricted method passed.
