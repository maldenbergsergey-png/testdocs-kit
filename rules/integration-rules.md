# Integration rules

**Status:** proposed portable contract for optional Jira, Confluence, and test-management integrations; pending human review.

Integrations transport context and reviewed output. They must not change QA policy, case-writing rules, or approval boundaries. The same QA workflow must remain usable from chat or local files when no integration is available.

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
| Jira QA work-item metadata | Read the exact non-defect work-item schema and authenticated user | Only for linked Test Run work-item creation |
| Jira QA work-item create | Create one validated non-defect QA work item and attach the created Test Run | Optional and approval-gated |
| QA Report delivery | Import a finalized checklist or fill an open report through its temporary API, including supported metadata and attachments | Optional and approval-gated |
| Source/change read | Retrieve an explicitly supplied GitLab issue, MR, commit, diff or pipeline result | Optional |
| Design read | Retrieve a supplied Figma file/node, render and supported design metadata | Optional |
| API workspace read | Retrieve a supplied Postman workspace, collection, specification, request or example | Optional |
| API workspace write | Create or update a Postman collection/specification/mock/monitor | Optional and approval-gated |
| Log read | Run a time- and environment-bounded Elastic/Kibana query and return sanitized evidence | Optional |
| Local mobile control | Inspect and interact with the selected Android/iOS test app and capture device evidence | Optional; scoped by the testing request |

Do not assume a capability exists because a server is named Jira, Confluence, Zephyr, or TMS. Inspect the tools exposed by the current connection. Preserve separate error states for unavailable capability, permission denied, not found, ambiguous instance, and empty result.

Local mobile execution follows `task-execution-rules.md` and the [Maestro profile](../integrations/profiles/maestro.md). Enabling a device-control connection does not authorize cloud uploads or publication to Jira, TMS or QA Report. Ordinary test-app interactions within an explicit testing request do not require a separate publication request for each tap.

## Input modes

### Supplied issue key or link

Treat an explicit issue key or URL as the primary scope anchor. Retrieve the issue and only the related material needed for the requested QA decision:

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

## Neutral context bundle

Normalize retrieved material into this tool-independent bundle:

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
Recommended downstream skill: ...
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

## TMS compatibility

Map any supported test-management product to the neutral test-case fields:

```text
Стабильный идентификатор и версия кейса
Название
Цель
Предусловия
Путь
Шаг, тестовые данные и ожидаемый результат в отдельных полях каждой строки
Постусловия
Теги типа и платформы
Статус
Приоритет
Папка или иерархия
Связи с требованиями и задачами
Комментарии и причина изменения при актуализации
Переиспользуемая подготовка или вызываемые общие шаги
```

Do not assume that test cases are Jira issues. Some products store them as separate test objects; others represent them through Jira issue types or vendor-specific entities. Use the capabilities exposed by the connected MCP server and preserve unsupported fields as explicit gaps.

Do not assume that a Test Run/Test Cycle is a Jira issue or that creating the container also attaches cases, links release tasks, creates executions, or assigns testers. Inspect and validate each supported operation and return the stable run identifier and URL supplied by the connector.

Do not treat request echo fields or a create-response count as proof of item assignment. Read the created Test Run back and compare its saved item assignees with the preflight mapping. A connector may use the public Test Result `assignedTo` update once for a mismatched existing item, but it must verify the saved result afterward and preserve a partial-failure state when any mismatch remains.

Treat Test Run folders separately from test-case folders. For Zephyr Server/DC, use the public Test Run search endpoint to discover exact paths represented by existing runs. The public API exposes folder create/update but no folder-tree read, so do not claim that an empty folder was checked. Root Test Run creation omits the `folder` field; it does not send `/`.

Do not assume modern Zephyr Scale endpoints, cloud field names, versioning, or call-step behavior for a legacy Test Management for Jira installation. Confirm the deployment, product version, and actual MCP tool schema first.

The installer records one active TMS provider: `zephyr_scale` for Zephyr Scale / legacy Test Management for Jira, or `qa_tools` for QA Tools (ТестОпс). Zephyr shares the configured Jira connection and requires no separate base URL or credentials. QA Tools is an independent connection and requires its instance URL plus an API token or local username/password authentication. Use the selected provider's exposed capabilities only; do not query both TMS products speculatively.

For QA Tools, prefer the vendor's version-matched `testops_*` MCP tools over hard-coded REST endpoints. Treat `testops_find_*`, `testops_get_*`, and `testops_list_*` as reads. Every other tool is a separate external change and requires installer opt-in plus exact user approval. The local proxy never exposes tool names containing `delete` or `remove`.

## Read and write boundary

Read-only retrieval is allowed when the user places the source in scope. Every workflow shows its result in chat by default. A user request that explicitly says to create or publish new cases may authorize creation in the same turn after the payload and exact target pass validation; no second confirmation is required. A request only to draft, generate, show, analyze, review, or check does not authorize a write.

The same intent rule applies to a Jira bug: an explicit request to create/file/register a bug in an identified project authorizes one creation after live create metadata and required fields are validated. A request only to draft, compose, format, or show a bug report does not authorize creation. Bug creation includes supplied evidence uploads and their previews/attachment links in the newly created Description under `bug-report-standard.md`. It does not authorize unrelated comments, issue links, transitions, later edits, or reassignment.

For Test Runs, a request to assemble, prepare, compose, show, or propose a run authorizes only reads and a reviewable proposal. An explicit request to create or register the Test Run and linked Jira QA work item authorizes only those named creations after the release, folder, case list, task relations, assignments, live Jira schema, and complete payloads are validated. Test Run creation does not authorize changing source cases or deleting a partially created run.

Treat these as separate write operations. New-case creation requires either an explicit same-request create/publication instruction or a later confirmation of a reviewed draft. All other operations require a separate explicit request after review:

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

For a TMS write, confirm the target Jira instance, project, TMS product, existing folder path (or explicit root), and exact operation. For creation, validate the complete case payload before the call and report the returned stable case key and full case URL afterward. After any successful case creation or permitted current-session correction, return a clickable full URL supplied by the connector. If the connector cannot supply one, report that gap and do not invent a route. Checklist delivery uses the narrower destination rules below. Never delete external cases automatically. A request to generate, analyze, review, or check actualization does not authorize publication.

The bundled integration exposes new-case creation, narrow correction of a case created by the running process, and guarded update of a previously existing case. Every update requires an explicit user instruction. Existing-case update additionally requires a content fingerprint captured from the complete baseline read; the adapter re-reads the case immediately before PUT and rejects a stale proposal when the fingerprint differs.

For every update, omitted fields remain unchanged. When changing steps, send the complete final ordered step list: the Server/DC API replaces the script, so a partial list can delete steps. Existing-case update is limited to supported content fields and cannot move, version, comment, link, transition, retire, or delete a case. On a fingerprint conflict, perform no write and require a refreshed proposal. Supplying issue links as part of initial creation remains allowed only when those exact links are in scope.

For every create, update, version, status, relation, or other supported TMS mutation, prepare a concise audit comment that states the affected content and the source task or requirement. A comment is a separate write and requires its own supported capability and authorization. Never store the audit comment in `Цель` as a workaround. If the mutation succeeds but the comment capability is absent or fails, report the two outcomes separately.

When a case objective contains Markdown links in the supported `[label](https://...)` form, the Zephyr adapter must serialize them as actual rich-text hyperlinks equivalent to `Insert link`. Preserve the readable label and exact direct URL; line-break conversion alone is insufficient.

## Checklist delivery

- A request to generate, show, copy, or prepare a checklist does not authorize publication.
- Jira publication requires the exact anchored issue key, the finalized Jira Wiki content, and an explicit publish request. Publish through the dedicated checklist-comment capability, not a generic comment or transition tool. The authenticated Jira account is the comment author. Report the returned comment ID or connector URL; never claim success without the response.
- QA Report delivery requires an explicit send/fill/open request and finalized content. Read [`../integrations/profiles/qa-report.md`](../integrations/profiles/qa-report.md) for the selected channel: the configured checklist-import connector or the user-supplied temporary API for an already open report. Supplying an API prompt as an example for discussion does not authorize a report write.
- An explicit request to fill the open report through a supplied temporary connection authorizes its documented context read, binary file uploads, batch submission, and receipt reads. Use an available HTTP tool or a terminal-launched HTTP client such as Node.js, Python, or `curl`; a dedicated local-import MCP is not required. Read the profile before declaring the protocol unavailable. The legacy `qa_report_import_checklist` tool and its installer opt-in are separate from this session channel; do not substitute its text-only import or ask the user to install another connector merely because it is the only QA Report MCP tool listed.
- The supplied session credential may be used for this authorized request under the handling rules in the profile. Its intentional inclusion in the user's temporary-connection prompt is not by itself a reason to refuse, rotate it, or request it again. This permission is limited to the supplied session and requested report operations; it does not relax Jira/TMS connector requirements or override an actual host/tool restriction. If a tool or network operation is blocked, report the observed restriction and use the host's normal approval path when available; do not invent a blanket ban on REST or shell requests.
- Filling a new empty report includes replacing its starter template. Do not ask for additional replacement permission merely because the editor has a report ID, a default section, blank rows, placeholder text, or default environment/status values. Distinguish these from real checklist content, results, attachments, and user-entered metadata using the available context and the user's identification of the report. Ask about replacement only when actual existing content would be lost and the requested operation does not already authorize replacing it; preserve existing content when the request is only to add results or files.
- By default, include the task's full URL and the testing environment/stand when they are known from the current task context; include the exact stand URL when supplied. Treat these as part of filling the report, without requiring a separate reminder or a second permission request. For execution reports use the environment actually tested; for a planned checklist do not imply that testing already occurred. Follow `project-conventions.md`; do not guess a domain, environment category, or mapping from a custom stand name.
- Fill the dedicated task-link and environment fields using the selected channel's supported contract. A mention in the checklist body is not proof that these fields were populated. Preserve correct existing values. A placeholder is not a task URL, and a starter environment/status is not evidence of the tested stand or a successful run. Replace starter defaults with known task values without another question. If a needed value is missing or conflicts with confirmed user-entered metadata, do not clear it or silently overwrite the conflict; request only the unresolved information and continue independent delivery work when the target report is unambiguous.
- If the chosen API cannot set a metadata field, use an available browser capability to fill that field in the same report within the authorized fill request, after the import has saved. If that capability is unavailable, report the exact unfilled field and its known value. Do not invent JSON fields or declare metadata saved because the server accepted an unrelated batch.
- Verify content, attachments, task link, and environment separately before reporting completion. For the temporary API, an authenticated receipt read for the submitted batch with `status: "saved"` confirms content/attachment persistence regardless of whether it was obtained through MCP, `curl`, or another HTTP client. HTTP 200 alone, `pending`, and the initial POST response do not prove saving. A separate agent browser connection is not required to read the receipt; visual layout and metadata verification remain separate checks through a supported read or the editor. Preserve successful batch IDs on partial failure and use the profile's idempotent retry contract.
- A request to deliver a completed report with screenshots includes the saved evidence for `OK` rows as well as other results unless the user explicitly narrows the selection. Follow the capture and reuse rules in `task-execution-rules.md`; attach existing files from the task workspace rather than re-executing checks to produce attachments. A text-only delivery does not fulfill a request for a report with screenshots; report unavailable or missing files explicitly.
- Do not put checklist content in a query string. Use only the editor URL returned by QA Report or the exact existing report supplied by the user; the temporary API URL is not an editor URL.
- Open that URL only when the user asks to open the editor and a browser capability is available. Use a separate external tab/window, never an iframe or embedded view. Otherwise return a clickable URL.
- Jira publication and QA Report import are independent. If one fails, report that result without implying the other succeeded or failed.
- When the user says they will publish to Jira themselves, finish at the saved QA Report checklist with its requested files and metadata. Do not invoke Jira writes or the editor's Jira publication action; preparing Jira-compatible markup and saving it in QA Report does not publish it to Jira.
- Both installer permissions remain disabled by default and are enabled independently. Do not enable generic Jira comments, issue transitions, or other write tools as a side effect.

## Least privilege

- Prefer read-only credentials or a read-only tool allowlist for onboarding and analysis.
- Keep tokens, passwords, cookies, and private keys out of reusable prompts/instructions, examples, repository files, logs, and committed configuration. The user-supplied temporary QA Report connection is runtime input for the authorized session, handled under its profile; do not copy its credential into reusable materials or echo it in output. Long-lived credentials and browser cookies retain their existing private configuration/authentication flows.
- Store browser-session cookies only in a service-specific private file, restrict them to the configured origin, and never return their values through MCP tools.
- Expose creation and updates only for explicit user requests. MCP adapters enforce their session provenance or baseline fingerprints; the QA Report temporary HTTP channel uses its documented session token, cell hashes, batch IDs, and saved receipts. Keep host-side write approvals enabled when the client supports them.
- Scope project configuration to trusted projects and approved servers.

## Browser-session authentication

Treat `AUTH_REQUIRED` as a recoverable authentication state, not as missing capability. Ask the user to complete the exact `npm run auth -- jira|confluence` browser flow returned by the connector, then retry the original read once.

Do not repeatedly open authentication while the stored session remains valid. Do not expose, request in chat, summarize, or log browser cookies or session-file contents. A normal `403` with an authenticated JSON response means insufficient permission and must not be treated as an expired session. Reauthenticate only for `401`, an authentication redirect, an explicit authentication-denied signal, a missing session, or a user-requested forced refresh.

## Tool-call discipline and recovered errors

- When a stable test-case key is known, call the direct case-read capability once; do not search the library first.
- Use project-wide search only for genuine discovery. Do not call `get all` merely to locate one known key, do not scrape structured MCP output with shell commands, and do not repeat an identical failing call with equivalent parameters.
- Prefer an adapter that performs product-version fallback inside one capability call. A failed internal endpoint that is recovered by a compatible endpoint is not a user-facing failure.
- Do not include raw intermediate endpoint errors or successful tool-call narration in the final response. Report a concise error only when the requested read or write still failed after the supported fallback.
- Never hide a final write failure or claim that a case was created or corrected unless the connector returned success.
