---
name: prepare-task-testing
description: Primary intent-based entry point for ordinary QA requests such as preparing a checklist, a full documentation package, only test cases, task-only cases outside regression, or a targeted subset from an issue, document, URL, file, or supplied requirement. Automatically choose the workflow without requiring skill names.
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
- A generic request to prepare testing for a task or an explicit full-documentation request selects `FULL_PACKAGE`.
- An explicit request for test cases without a checklist selects `CASES_ONLY`.
- An explicit request for task-only cases or cases outside the regression model selects `TASK_SCOPED_CASES`.
- A request to optimize or refactor several existing cases selects `OPTIMIZE_EXISTING` and routes to `review-test-cases` for a structural proposal.
- A request for review only selects `REVIEW_ONLY` and routes to `review-test-cases`.
- A request limited to a named block, scenario, case type, or task slice applies `TARGETED_SCOPE` to the selected branch.
- Do not require `$skill-name` or ask the user to choose internal steps.

## Shared context collection

Use [`../collect-test-context/SKILL.md`](../collect-test-context/SKILL.md) with the selected intent. With a supplied issue key/link, anchor retrieval there. Treat a supplied Confluence URL, document, file, or chat requirement as a valid standalone scope when no issue is supplied. Combine Jira, knowledge pages, comments and user context according to their stated authority; do not infer priority from storage location.

## CHECKLIST_ONLY

Route the normalized context to [`../generate-test-checklist/SKILL.md`](../generate-test-checklist/SKILL.md). Avoid broad TMS discovery. Return the Jira Wiki checklist and relevant limitations in Russian.

## FULL_PACKAGE

1. Generate the task checklist.
2. Perform targeted TMS discovery: direct task links; explicitly cited cases; relevant parent/epic/function relations; focused search by stable page/function/block/scenario terminology; confirmed TMS folder/area. Never use project-wide `get all` by default.
3. Record discovery as `COMPLETE`, `PARTIAL`, or `UNAVAILABLE`, including search scope and limitations.
4. Route permanent scenarios to [`../analyze-test-coverage/SKILL.md`](../analyze-test-coverage/SKILL.md).
5. Generate complete cases only for supported `CREATE` decisions and complete proposals only for `UPDATE`. Show `RETIRE_PROPOSAL` and `NO_CHANGE` explicitly.
6. Format the result exactly as required by `task-testing-rules.md`.

## CASES_ONLY and TASK_SCOPED_CASES

Route directly to [`../generate-test-cases/SKILL.md`](../generate-test-cases/SKILL.md) with the exact requested scope. For `CASES_ONLY`, leave regression membership unclassified unless requested. For `TASK_SCOPED_CASES`, explicitly keep the generated cases outside the permanent regression model. Do not add a checklist or broad TMS discovery.

## OPTIMIZE_EXISTING and REVIEW_ONLY

Route the supplied complete cases to [`../review-test-cases/SKILL.md`](../review-test-cases/SKILL.md). Optimization may propose consolidation, shared base cases, delta-only variants, splits, and retirement of duplicates for human review. Review-only remains limited to findings and supported corrections. Neither branch writes externally.

Never write to an external system during preparation. Creation, update, retirement/status changes and publication require a separate explicit request under their specialized skill and integration contract.

An explicit same-request instruction such as “подготовь и опубликуй checklist в Jira” or “подготовь и открой в QA Report” includes the corresponding delivery intent. First show/finalize the checklist, then follow the delivery contract in `generate-test-checklist`. It does not authorize any other write.
