---
name: create-bug-report
description: Turn informal, dictated, or voice-transcribed defect notes into a structured bug report, gather relevant environment details, requirements, designs, logs, requests, responses, screenshots, and recordings from explicitly scoped sources, adapt the report to the live field schema of a specified Jira project, and create the Jira bug when explicitly requested. Use for requests to draft, compose, file, create, register, or report a software bug or defect, including standalone issues and defect subtasks.
---

# Create bug report

Prepare a source-backed defect draft and optionally create it through the connected Jira capability.

## Read the source of truth

Before work, read:

- [`../../rules/bug-report-standard.md`](../../rules/bug-report-standard.md)
- [`../../rules/integration-rules.md`](../../rules/integration-rules.md)
- [`../../integrations/profiles/jira-confluence.md`](../../integrations/profiles/jira-confluence.md) when Jira capability or field behavior needs clarification
- [`../../rules/project-conventions.md`](../../rules/project-conventions.md) whenever project-specific values, fields, environments, routing, or issue relationships are involved

## Determine intent and scope

Classify the request as `DRAFT_ONLY` or `CREATE_IN_JIRA` using the write boundary in `bug-report-standard.md`. Treat voice transcription as ordinary supplied context: remove filler and false starts without changing the reported facts.

Identify the target Jira instance and project from an explicit key, URL, project name, approved configuration, or unambiguous current context. Do not search or choose an arbitrary company project. If several instances or projects fit, stop before metadata retrieval and request the target.

Use supplied requirements, issues, links, screenshots, logs, and files only when they are explicitly in scope. Retrieve an anchored Jira issue or knowledge link through `collect-test-context` when it materially defines expected behavior. When the user explicitly asks to find missing material, search only within the named project, space, system, or relations of the supplied anchor. Do not browse an arbitrary company system.

## Build the semantic draft

1. Extract the affected area, system scope or mobile platform, condition, observed behavior, reproduction path, actual result, expected result, environment URL, client/build details, reproducibility, and evidence.
2. Separate facts from assumptions and suspected causes. Do not put a suspected cause in the summary as fact.
3. Decide whether the bug is a standalone defect or a subtask using the source feature/release context and live Jira schema. Never invent a parent issue.
4. Collect the minimum relevant diagnostic materials by defect type. Resolve direct named links to referenced documentation, analytics, designs, pages, APIs, and logs when they are available from the scoped context.
5. Apply the title, content, environment, security, and evidence rules from `bug-report-standard.md`.
6. Ask for a missing fact only when the bug cannot be understood or reproduced, expected behavior cannot be established, or Jira creation cannot pass required-field validation. Otherwise show the draft with concise `Требует уточнения` markers.

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

## Return the result

After creation, return:

- clickable issue key and full URL supplied by the connector;
- final summary;
- assignee and specialist values actually applied;
- optional routing fields left unset for tester triage;
- uploaded attachments and preview status, plus exact pending materials or verification gaps.

Apply the write boundary in `bug-report-standard.md`: supplied evidence uploads and their Description previews belong to the create workflow; unrelated later mutations require an explicit request.
