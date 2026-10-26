# External writes

## Read and write boundary

This contract governs QA artifacts and integration/workspace changes. Ordinary actions in the application under test, including test-account consent and form/application submission, follow [test-environment authorization](execution-access-rules.md#действия-в-тестовой-среде). A request to test already authorizes those scoped actions; it does not authorize QA publication.

Read-only retrieval is allowed when the user places the source in scope. Every workflow shows its result in chat by default. A user request that explicitly says to create or publish new cases may authorize creation in the same turn after the payload and exact target pass validation; no second confirmation is required. A request only to draft, generate, show, analyze, review, or check does not authorize a write.

For Postman collection maintenance, follow [collection rules](postman-collection-rules.md). An explicit request to apply/save request and autotest changes to the selected collection authorizes that scoped write after payload validation, current-destination preflight and any required client/configuration write opt-in; no repeated confirmation is needed. Merely describing an API task or binding a collection authorizes read/compare/draft, not publication. Connection changes, scheduled publication, forks and live runs require their own scoped intent. This does not permit updates to old TMS cases.

The same intent rule applies to a Jira or Eva bug: an explicit request to create/file/register a bug authorizes one creation after the exact target, live creation structure and required fields are validated. Eva additionally requires the tester's explicit choice of feature subtask (with a selected parent) or project backlog (with a selected project); both use type `Ошибка` under the [bug contract](bug-report-standard.md#eva-defect-contract). A request only to draft, compose, format, or show a bug report does not authorize creation. Bug creation includes supplied evidence uploads and their previews/attachment links in the newly created Description. It does not authorize unrelated comments, issue links, transitions, later edits, or reassignment.

An Eva form may create a server-side draft when opened. Opening that form is therefore part of the authorized write workflow, not read-only metadata discovery; it requires create intent, the explicit route and its required parent or project first. The [Eva profile](../integrations/profiles/eva.md) defines the browser channel and optional adapter boundary. Respect the selected channel's client permissions and opt-in; never switch channels to bypass a denied write.

For Test Runs, a request to assemble, prepare, compose, show, or propose a run authorizes only reads and a reviewable proposal. An explicit request to create or register the Test Run and linked Jira QA work item authorizes only those named creations after the release, folder, case list, task relations, assignments, live Jira schema, and complete payloads are validated. Test Run creation does not authorize changing source cases or deleting a partially created run.

An explicit request to modify an existing Test Run authorizes the named field, membership, order, assignment or result diff after current-state validation under [existing-run rules](test-run-rules.md#existing-test-run-management). Removing selected run items includes their execution history; it does not delete source cases. Deleting the entire run needs explicit deletion intent. Existing-run management has its own connection opt-in and does not relax the restriction on old source cases.

Treat these as separate write operations. New-case creation requires either an explicit same-request create/publication instruction or a later confirmation of a reviewed draft. Direct API checklist/report delivery follows the initial-request authorization in [delivery rules](checklist-delivery-rules.md#direct-api-delivery). Other operations require a separate explicit request after review:

- create a test case;
- create a new version;
- modify fields or steps;
- link a case to an issue or requirement;
- add a comment;
- change lifecycle status;
- move a case or change folder membership;
- publish a checklist as a Jira comment;
- send a checklist to QA Report.

Test Run container creation, case attachment, release-task linking, execution assignment, Jira QA work-item creation, and attachment of the run to that work item are separate external operations even when a connector exposes a composite call. Preflight the whole requested workflow before its first mutation. Create the run first so its returned stable reference can be used by the Jira work item. If a later step fails, preserve and report successful object identifiers and do not automatically delete, duplicate, or retry a mutation whose outcome is uncertain.

For a TMS write, confirm the target Jira instance, project, TMS product, existing folder path (or explicit root), and exact operation. For creation, validate the complete case payload before the call and report the returned stable case key and full case URL afterward. After any successful case creation or permitted current-session correction, return a clickable full URL supplied by the connector. If the connector cannot supply one, report that gap and do not invent a route. Checklist delivery uses the [destination rules](checklist-delivery-rules.md). Never delete external cases automatically. A request to generate, analyze, review, or check actualization does not authorize publication.

The bundled integration exposes new-case creation and narrow correction of a case created by the running MCP process. Read [update-rules.md](update-rules.md) before any case correction. Previously existing cases remain proposal-only under the temporary restriction; baseline fingerprints cannot bypass it.

An explicit request to publish new cases with screenshots includes the selected image uploads to their steps. Later image changes require explicit correction intent and the same current-chat origin/registry guard. Drafting images or choosing their source authorizes no TMS write. Follow [case image rules](test-case-image-rules.md); uploading to an old case is an update even if its text stays unchanged.

For a connected Zephyr provider, new-case creation and corrections of those new cases in the same chat are available without a separate setup opt-in. `enableWrites: false` controls general writes and does not block these tools; the obsolete `enableTestCaseCreation` setting is not an authorization check. Use the actual exposed tool inventory. A user request to create new cases authorizes their validated creation in that turn, without another confirmation; a correction requires its own explicit instruction and the current-chat origin plus the server creation registry. Missing access, target or required case data remains a real limitation.

In a mixed request, handle new cases and previously existing cases separately: create the requested new cases, return proposals for the old ones, and retain unresolved scenarios for clarification. The old-case restriction does not block independent new-case creation. Do not create replacement copies of old cases to evade it. A draft-only request still publishes nothing, and an actual host/client denial is not bypassed.

For permitted session corrections, omitted fields remain unchanged. When changing steps, send the complete final ordered step list: the Server/DC API replaces the script. The correction cannot implicitly move, version, comment, link, transition, retire or delete a case. Initial-creation issue links remain allowed only when those exact links are in scope.

For every create, update, version, status, relation, or other supported TMS mutation, prepare a concise audit comment that states the affected content and the source task or requirement. A comment is a separate write and requires its own supported capability and authorization. Never store the audit comment in `Цель` as a workaround. If the mutation succeeds but the comment capability is absent or fails, report the two outcomes separately.

When a case objective contains Markdown links in the supported `[label](https://...)` form, the Zephyr adapter must serialize them as actual rich-text hyperlinks equivalent to `Insert link`. Preserve the readable label and exact direct URL; line-break conversion alone is insufficient.
