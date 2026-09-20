# Integration rules

**Status:** active portable baseline; project-specific placeholders remain unresolved until supplied.

Integrations transport context and reviewed output. They must not change QA policy, case-writing rules, or approval boundaries. The same QA workflow must remain usable from chat or local files when no integration is available.

Load [TMS compatibility](tms-integration-rules.md) only for TMS access. Before an external write, read [external-write-rules.md](external-write-rules.md); for requested Jira checklist or QA Report delivery, also read [checklist-delivery-rules.md](checklist-delivery-rules.md). Those links do not require loading write contracts for read-only tasks.

## Capability model

Identify integrations by capability rather than product name or MCP tool name:

| Capability | Purpose | Required? |
| --- | --- | --- |
| Issue read | Retrieve one supplied task, bug, story, epic, or other work item | Only for an issue-key workflow |
| Issue relations | Retrieve relevant parent, child, linked issue, attachment, and decision context | Optional |
| Knowledge read | Retrieve a supplied or issue-linked specification or Confluence page | Optional |
| TMS read | Find and read existing cases, versions, links, folders, and lifecycle metadata | Optional |
| TMS write | Create, update, link, comment on, version, or change status of reviewed cases | Optional and approval-gated |
| Release scope read | Resolve an exact release version and retrieve the issues included in it | Only for a release Test Run workflow |
| Test Run read | Read Test Run/Test Cycle metadata, linked cases, executions, assignments, and relations | Optional |
| Test Run create | Create one validated Test Run/Test Cycle, attach cases and release tasks, and assign executions | Optional and approval-gated |
| Jira checklist comment | Publish finalized Jira Wiki checklist to the anchored issue as the authenticated user | Optional and approval-gated |
| Jira create metadata | Read the authenticated user and exact project/type field schema needed for a bug draft | Only for Jira bug creation |
| Jira bug create | Create one validated defect issue and return its key and URL | Optional and approval-gated |
| Eva bug creation | Live form and `Ошибка` creation in the tester-selected feature or backlog route | Optional; [Eva profile](../integrations/profiles/eva.md), explicit create intent and target required even to open the form |
| Jira QA work-item metadata | Read the exact non-defect work-item schema and authenticated user | Only for linked Test Run work-item creation |
| Jira QA work-item create | Create one validated non-defect QA work item and attach the created Test Run | Optional and approval-gated |
| QA Report delivery | Import a finalized checklist or fill an open report through its temporary API, including supported metadata and attachments | Optional and approval-gated |
| Source/change read | Retrieve an explicitly supplied GitLab issue, MR, commit, diff or pipeline result | Optional |
| Design read | Retrieve a supplied Figma file/node, render and supported design metadata | Optional |
| API workspace read | Retrieve a supplied Postman workspace, collection, specification, request or example | Optional |
| API workspace write | Create or update a Postman collection/specification/mock/monitor | Optional and approval-gated |
| Log read | Run a time- and environment-bounded Elastic/Kibana query and return sanitized evidence | Optional |
| Local mobile control | Inspect the selected Android/iOS app for product context or execute scoped tests and capture evidence | Optional; scoped by the request |

Do not assume a capability exists because a server is named Jira, Confluence, Zephyr, or TMS. Inspect the tools exposed by the current connection. Preserve separate error states for unavailable capability, permission denied, not found, ambiguous instance, and empty result.

Local mobile execution follows `task-execution-rules.md` and the [Maestro profile](../integrations/profiles/maestro.md). Enabling a device-control connection does not authorize cloud uploads or publication to Jira, TMS or QA Report. Ordinary test-app interactions within an explicit testing request do not require a separate publication request for each tap.

## Input modes

### Supplied issue key or link

Treat an explicit issue key or URL as the primary scope anchor. Apply the common contract's context-reuse rule first; when retrieval is needed, retrieve the issue and only the related material needed for the requested QA decision:

- summary, description, acceptance criteria, status, and relevant structured fields;
- comments that contain decisions, corrections, unresolved questions, or previous tester checklists/execution evidence relevant to the current scope;
- relevant parent, child, linked requirement, bug, or dependency;
- linked knowledge pages and attachments needed to understand behavior;
- existing test cases linked to the issue or identified by a supported TMS relation.

Do not crawl the whole project, space, or test library unless the user explicitly requests broader discovery.

### No supplied issue key or link

Use the context supplied in chat, files, or other explicitly scoped sources. Do not search an arbitrary Jira project merely because an issue integration is connected. If facts needed for an executable result are missing, request them using the active skill's missing-context behavior.

A standalone Confluence or knowledge-page URL is a valid primary scope anchor even when no Jira issue exists. Retrieve that exact page and only materially relevant linked sources. Do not require an issue key, infer an issue, or broaden to the whole knowledge space.

An exact release version is a valid scope anchor for a Test Run request. Resolve that version in the explicitly supplied Jira project or connection, retrieve only its release issues and materially linked requirements, then search cases only inside the user-specified TMS folder boundary. Do not infer a project from the version name or broaden the search to another release or the whole test library.

### Live product context

- A user-scoped browser page, native app/screen, or supplied recording/screenshot can inform a matrix, checklist, or test cases without an issue key. Use the relevant surface rules for [web](execution-web-rules.md), [native](execution-native-rules.md), or [supplied media](execution-media-rules.md), loading only the relevant surface; load the [Maestro profile](../integrations/profiles/maestro.md) only for native device control.
- For documentation, inspect only the necessary navigation, blocks, controls and states. Return the requested artifact; a separate execution checklist, test run and statuses require testing intent. Ordinary navigation is within the inspection request; data-changing test scenarios are not implicit in a documentation request.
- Preserve the navigation path, platform/OS, device type, known build/environment, and screenshot or recording timestamp as source provenance. Keep `app` as the native platform tag and record iOS/Android and device distinctions in source notes; observation on one configuration does not establish another.
- Use observations for actual structure and labels. Approved requirements or confirmed user criteria define expected behavior; current behavior alone proves neither correctness nor permanent TMS coverage. Mark missing behavior and unobserved areas explicitly.

## Neutral context bundle

Normalize retrieved material into this tool-independent bundle. Include only applicable fields and preserve completeness inside the requested scope; do not print empty sections or enumerate unrelated capabilities:

```text
Request intent: estimate QA effort | explain task testing | execute task testing | prepare testing (checklist-only | full package | cases-only | task-scoped cases | optimize | review; optional targeted scope) | prepare bug report (draft | create) | prepare test run (draft | create) | analyze coverage | update | build matrix | build regression model
Input mode: ISSUE_ANCHORED | RELEASE_ANCHORED | KNOWLEDGE_ANCHORED | TMS_ANCHORED | MANUAL_CONTEXT
Scope anchor: issue key/link, exact release version, or supplied-context description
Issue facts: summary, behavior, acceptance criteria, status, decisions
Relevant comment evidence: evidence type, relevant content, exact comment link or ID, author/date when available, and corroboration status for previous checklists
Relevant linked requirements and knowledge: stable ID/link, title, version when available, relevant content
Relevant source links: exact URL, readable purpose, source location, retrieval status, and whether it influenced the requested QA result
Change context: GitLab object URL, stable ID/SHA, changed behavior surface, pipeline result and retrieval status
Design context: Figma file/node URL, viewport/state, retrieved properties/render and limitations
Product context when applicable: navigation path, platform/device type, known OS/build/environment, observed structure, evidence provenance and limits
API context: Postman workspace/collection/request IDs, environment identity without secrets, contract/example provenance
Log context: environment, time zone/window, service/correlation scope, query, sanitized result and retrieval status
Source field inventory: every explicitly defined field, control, tab, default, validation, visibility condition, role, state, and constraint; each marked retrieved, ambiguous, or unavailable
Existing test coverage: stable case IDs, versions, lifecycle, links, and complete case content when needed
Existing coverage discovery: COMPLETE | PARTIAL | UNAVAILABLE; directly linked cases; discovered relevant cases; search scope; limitations
Test Run scope when applicable: launch kind; coverage depth; platform; TMS folder; eligible testers; title convention; case-to-task traceability; assignment proposal
Estimation context when applicable: parent/story and task/subtask boundary map; linked-task dependencies and retrieval completeness; team criteria and scope; platform matrix; environments, stages and QA handoffs; shared work allocation; known documentation/automation coverage and human validation; comparable effort history and provenance; baseline estimate or actuals for a comparison
Source conflicts: ...
Missing capabilities or permissions: ...
Missing behavioral context: ...
Source inventory: system, stable identifier, retrieval time when available

```

Keep raw external values alongside any neutral interpretation. Do not silently translate workflow statuses, priorities, folders, labels, or custom fields.

## Source and conflict handling

- Treat retrieved content according to its supplied authority, not according to the system that stores it.
- Do not assume that a Jira description is newer than a linked specification or that the latest comment overrides approved acceptance criteria.
- Treat a previous tester checklist or execution note in a comment as practitioner evidence: use it to find scenarios and risk areas, but do not treat it as an approved requirement, current expected behavior, or proof of permanent TMS coverage. Preserve its provenance and corroborate reused checks against current sources.
- Report conflicting behavior or versions and request a decision when the conflict changes coverage or expected results.
- Retrieve only fields and attachments relevant to the QA task. Avoid collecting credentials, personal data, or unrelated comments.
- Inventory URLs in the primary issue and every scoped knowledge page. Follow only links that can materially define the requested behavior, especially linked requirements, designs/mockups, API contracts, attachments, and related decision documents. Record the exact URL, visible label or retrieved title, source location, and retrieval status. Do not recursively crawl unrelated navigation or an entire knowledge space.
- A discovered link is not evidence that its target was read. Mark inaccessible targets as unavailable. Include such a link in a case only when its purpose is identifiable from authoritative source text; otherwise raise the missing context instead of inventing a label.
- When the source describes a form, entity, table, API object, or configurable screen, enumerate every explicitly defined field and its supported properties before summarizing. Do not collapse unprocessed rows into “other fields” or silently omit a field because it looks secondary.
- Do not imply that linked pages or cases were checked when a tool, permission, or relation was unavailable.

## Least privilege

- Prefer read-only credentials or a read-only tool allowlist for onboarding and analysis.
- Keep tokens, passwords, cookies, and private keys out of reusable prompts/instructions, examples, repository files, logs, and committed configuration. The user-supplied temporary QA Report connection is runtime input for the authorized session, handled under its profile; do not copy its credential into reusable materials or echo it in output. Long-lived credentials and browser cookies retain their existing private configuration/authentication flows.
- Store browser-session cookies only in a service-specific private file, restrict them to the configured origin, and never return their values through MCP tools.
- Expose creation and updates only for explicit user requests. MCP adapters enforce current-session provenance for case corrections; the QA Report temporary HTTP channel uses its documented session token, cell hashes, batch IDs, and saved receipts. Keep host-side write approvals enabled when the client supports them.
- Scope project configuration to trusted projects and approved servers.

## Browser-session authentication

For browser retrieval or an authentication error, follow [browser session reuse](browser-session-rules.md). Readable content in the user's selected browser is sufficient for that read; a separate connector's `AUTH_REQUIRED` does not require another login.

When capturing source images, apply [evidence framing and verification](execution-evidence-rules.md#полнота-и-контекст-кадра). Capturing requirements does not start a test run or require an execution report.

## Tool-call discipline and recovered errors

- When a stable test-case key is known, call the direct case-read capability once; do not search the library first.
- Use project-wide search only for genuine discovery. Do not call `get all` merely to locate one known key, do not scrape structured MCP output with shell commands, and do not repeat an identical failing call with equivalent parameters.
- Prefer an adapter that performs product-version fallback inside one capability call. A failed internal endpoint that is recovered by a compatible endpoint is not a user-facing failure.
- Do not include raw intermediate endpoint errors or successful tool-call narration in the final response. Report a concise error only when the requested read or write still failed after the supported fallback.
- Never hide a final write failure or claim that a case was created or corrected unless the connector returned success.
