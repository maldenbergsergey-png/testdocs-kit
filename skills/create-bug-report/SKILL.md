---
name: create-bug-report
description: Turn informal or dictated defect notes and scoped evidence into a structured bug report. Draft or explicitly create a Jira or EvaTeam/EvaProject bug after checking the live task structure. Use for requests to compose, file, create, register, or report a software bug; Eva supports feature subtasks and project backlog defects with an explicit routing choice.
---

# Create bug report

Prepare a source-backed defect draft and optionally create it in Jira or Eva through an available, authorized capability.

Read [the common contract](../../rules/core.md) once per task. Follow conditional rule links only when their condition applies.

## Read the source of truth

Before work, read:

- [`../../rules/bug-report-standard.md`](../../rules/bug-report-standard.md)
- [`../../rules/integration-rules.md`](../../rules/integration-rules.md)
- [`../../integrations/profiles/jira-confluence.md`](../../integrations/profiles/jira-confluence.md) when Jira capability or field behavior needs clarification
- [`../../integrations/profiles/eva.md`](../../integrations/profiles/eva.md) for Eva task structure, creation, rendering and evidence transport
- [`../../rules/project-conventions.md`](../../rules/project-conventions.md) whenever project-specific values, fields, environments, routing, or issue relationships are involved

## Determine intent and scope

Classify the request as `DRAFT_ONLY`, `CREATE_IN_JIRA` or `CREATE_IN_EVA` using the write boundary in `bug-report-standard.md`. Treat voice transcription as ordinary supplied context: remove filler and false starts without changing the reported facts.

Identify the target tracker and instance from the supplied context. In Jira, identify the project from an explicit key, URL, project name, approved configuration, or unambiguous current context. In Eva, establish the tester's explicit choice: feature subtask or project backlog. Ask only when the choice is missing. For a subtask, require the tester-selected parent and derive its project; for backlog, require the selected project without requesting a parent. A source task or open tab alone does not select the route. Do not search or choose an arbitrary company project. If several instances fit, request the target before retrieval.

Use supplied requirements, tasks, links, screenshots, logs, code and files only when they are explicitly in scope. Retrieve missing or stale content from an anchored task or knowledge link through `collect-test-context` when it materially defines expected behavior. When the user explicitly asks to find missing material, search only within the named project, space, system, or relations of the supplied anchor. Do not browse an arbitrary company system.

## Build the semantic draft

1. Extract the affected area, system scope or mobile platform, condition, observed behavior, reproduction path, actual result, expected result, environment URL, client/build details, reproducibility, and evidence.
2. Separate facts from assumptions and suspected causes. Do not put a suspected cause in the summary as fact.
3. For Jira, choose standalone defect or subtask using the source feature/release context and live schema. For Eva, apply the feature-subtask or project-backlog route in `bug-report-standard.md`. Never infer the route or invent a parent issue.
4. Collect the minimum relevant diagnostic materials by defect type. Resolve direct named links to referenced documentation, analytics, designs, pages, APIs, and logs when they are available from the scoped context.
5. Apply the title, content, environment, security, and evidence rules from `bug-report-standard.md`.
6. Ask for a missing fact only when the bug cannot be understood or reproduced, expected behavior cannot be established, or the destination's creation contract cannot be satisfied (including Eva's route and its required parent or project). Otherwise show the draft with concise `Требует уточнения` markers.

For `DRAFT_ONLY`, return the title, structured content, known routing values, and missing fields in chat. Perform no external write.

## Adapt to Jira

For `CREATE_IN_JIRA`:

1. Discover available tools by capability. Require issue-create metadata and bug-create capabilities; do not substitute generic comments or browser form automation.
2. Call the create-metadata capability for the exact project. In Jira Cloud, first list issue types and then repeat with the selected defect issue-type ID to retrieve its fields; Server/Data Center may return expanded fields in one call. Inspect the authenticated user, available issue types, field IDs, displayed names, schemas, allowed values, defaults, required flags, and operations.
3. Select the actual standalone defect or defect-subtask issue type. For a subtask, set the exact supplied or source-backed parent using the live schema. Complete the field inventory and semantic mapping required by `bug-report-standard.md`, including optional custom fields for steps, actual result, and expected result. Use `additionalFields` (or the connector equivalent) with live IDs and correct serialization. Use `Описание` only for blocks whose dedicated writable fields are absent; resolve mapping gaps before creation.
4. Set assignee to the authenticated current user when supported. Let Jira set reporter/author to that authenticated user. Use the same user for an unambiguous specialist/system-developer field when its live schema accepts that user shape.
5. Apply labels, components, priority, severity, versions, teams, and other routing only from approved project rules, explicit user input, unambiguous defaults, or allowed values. Omit optional guesses.
6. Validate every required field. If a required value is missing, show the nearly complete payload and request only that value; do not create yet.
7. Preflight the supplied evidence and preview plan under `Supplied attachments and previews` in `bug-report-standard.md`. With the bundled connector, pass available evidence as `attachments` entries (`path`, safe `filename`, `mimeType`); use `descriptionFormat: "wiki"` only for a confirmed Server/DC Wiki renderer. The bundled uploader accepts at most 20 files, each within Jira’s upload limit and a 25 MiB local cap (10 MiB fallback when Jira supplies no limit).
8. Call the dedicated bug-create capability once with `confirmed: true`. Include only fields supported by the retrieved metadata. Complete the supported upload/preview operations against that returned key, or inspect the composite connector’s per-file outcomes.
9. Read the created issue back and compare saved semantic fields and attachments with the preflight mapping. Do not repeat creation to repair a mismatch.

If metadata or creation capability is unavailable, return a Jira-ready draft and state the exact capability gap. Do not claim creation.

## Adapt to Eva

For `CREATE_IN_EVA`:

1. Establish the explicit route from the conversation. If absent, ask whether the bug belongs to a feature or the backlog. For a feature subtask, request the exact parent if missing. For backlog, request the exact project if missing; do not request a parent. Prepare the useful draft while these facts are unresolved, without opening a creation form or creating a server draft.
2. Read the selected parent/project. Follow the Eva profile to inspect the authenticated tester, the live creation form for this route (subtask or project/header backlog creation), the available `Ошибка` type, required fields and editor/upload capabilities. The bundled Eva MCP supplies reads; the profile describes the supported browser creation path and the requirements for an optional write adapter.
3. Map the report to the actual form. Use `iOS. ` or `Android. ` for the known mobile platform, followed by what/where/when. When semantic fields are absent, put numbered reproduction steps, expected result and actual result under headings in Description. Include relevant screenshots, source-backed code excerpts and other evidence using the editor's supported formatting.
4. Set assignee and reporter to the current tester and apply only the minimal fields allowed by `bug-report-standard.md`. Verify `Ошибка` and either the parent/subtask relationship or the selected project's backlog destination without a feature parent. If an additional mandatory field or ownership requirement cannot be satisfied, preserve the prepared content and ask for that specific decision before final submission.
5. Preflight files, upload them through the supported form/adapter and submit once, following the profile's handling of server drafts and uncertain outcomes. An explicit create request already authorizes these steps; do not ask for a second confirmation when the payload is ready.
6. Read the saved task back and compare its route/destination, type, title, report, ownership and attachments with the intended values. Return the actual key/link and any partial failure. Do not repeat creation to repair missing evidence or a verification gap.

If the live form or required capabilities are unavailable, return the complete Eva-ready draft and name the exact gap. A read-only MCP connection alone does not prove creation is possible.

## Return the result

After creation, return:

- clickable issue key and full URL supplied by the connector;
- final summary;
- assignee and reporter actually applied; specialist only for Jira when applicable;
- Eva route, actual parent or project/backlog destination, and defect type;
- optional routing fields left unset for tester triage;
- uploaded attachments and preview status, plus exact pending materials or verification gaps.

Apply the write boundary in `bug-report-standard.md`: supplied evidence uploads and their Description previews belong to the create workflow; unrelated later mutations require an explicit request.
