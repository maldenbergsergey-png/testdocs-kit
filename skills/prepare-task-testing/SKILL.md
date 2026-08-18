---
name: prepare-task-testing
description: Primary task-first entry point for ordinary QA requests such as "prepare testing", "prepare full test documentation", "what should be tested", or "prepare a checklist" for an issue key, URL, or supplied requirement. Automatically choose checklist-only or full-package workflow without requiring skill names.
---

# Prepare task testing

Orchestrate the existing portable skills while keeping internal routing invisible in the user-facing result.

## Read the source of truth

Before work, read:

- [`../../rules/task-testing-rules.md`](../../rules/task-testing-rules.md)
- [`../../rules/test-checklist-standard.md`](../../rules/test-checklist-standard.md)
- [`../../rules/coverage-rules.md`](../../rules/coverage-rules.md) for the full-package branch
- [`../../rules/integration-rules.md`](../../rules/integration-rules.md)
- downstream rule files referenced by every skill actually used

## Route by intent

- An explicit checklist request selects `CHECKLIST_ONLY`.
- A generic request to prepare testing/documentation or an explicit full-package request selects `FULL_PACKAGE`.
- Do not require `$skill-name` or ask the user to choose internal steps.

## Shared context collection

Use [`../collect-test-context/SKILL.md`](../collect-test-context/SKILL.md) with intent `prepare task testing`. With a supplied issue key/link, anchor retrieval there. With manual context, use only supplied sources. Combine Jira, knowledge pages, comments and user context according to their stated authority; do not infer priority from storage location.

## CHECKLIST_ONLY

Route the normalized context to [`../generate-test-checklist/SKILL.md`](../generate-test-checklist/SKILL.md). Avoid broad TMS discovery. Return the Jira Wiki checklist and relevant limitations in Russian.

## FULL_PACKAGE

1. Generate the task checklist.
2. Perform targeted TMS discovery: direct task links; explicitly cited cases; relevant parent/epic/function relations; focused search by stable page/function/block/scenario terminology; confirmed TMS folder/area. Never use project-wide `get all` by default.
3. Record discovery as `COMPLETE`, `PARTIAL`, or `UNAVAILABLE`, including search scope and limitations.
4. Route permanent scenarios to [`../analyze-test-coverage/SKILL.md`](../analyze-test-coverage/SKILL.md).
5. Generate complete cases only for supported `CREATE` decisions and complete proposals only for `UPDATE`. Show `RETIRE_PROPOSAL` and `NO_CHANGE` explicitly.
6. Format the result exactly as required by `task-testing-rules.md`.

Never write to an external system during preparation. Creation, update, retirement/status changes and publication require a separate explicit request under their specialized skill and integration contract.
