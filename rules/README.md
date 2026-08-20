# Shared rules

This directory is the source of truth for QA test-documentation policy. Skills define procedures; these files define standards and decision criteria.

## Rule files

- [`test-case-standard.md`](test-case-standard.md) — test-case content and writing standard.
- [`test-checklist-standard.md`](test-checklist-standard.md) — task- or document-scoped Jira checklist contract.
- [`task-testing-rules.md`](task-testing-rules.md) — intent routing for checklist, full-package, cases-only, task-scoped, optimization, review, and targeted workflows.
- [`test-case-type-rules.md`](test-case-type-rules.md) — E2E, overview, block, cross-page, integration, and platform classification.
- [`test-case-lifecycle-rules.md`](test-case-lifecycle-rules.md) — lifecycle statuses, review readiness, and task linkage.
- [`reusable-setup-rules.md`](reusable-setup-rules.md) — shared preparation procedures, administration content, dependency outputs, and cleanup.
- [`integration-rules.md`](integration-rules.md) — optional issue, knowledge, and TMS capability contract plus read/write boundaries.
- [`coverage-rules.md`](coverage-rules.md) — permanent coverage decision rules.
- [`coverage-matrix-rules.md`](coverage-matrix-rules.md) — functionality decomposition and scenario-to-case mapping.
- [`regression-model-rules.md`](regression-model-rules.md) — construction and maintenance of a traceable regression coverage model.
- [`update-rules.md`](update-rules.md) — safe changes to existing cases.
- [`review-rules.md`](review-rules.md) — review criteria and finding severity.
- [`standard-derivation-rules.md`](standard-derivation-rules.md) — evidence and approval rules for deriving shared policy from a documentation corpus.
- [`project-conventions.md`](project-conventions.md) — explicitly scoped product conventions that must not be generalized to unrelated projects.

## Placeholder policy

Items marked **PLACEHOLDER** require team-specific decisions. Until a placeholder is replaced with approved policy:

1. Do not infer a company convention.
2. Preserve any convention explicitly supplied in the task context.
3. Otherwise label the decision as unresolved and use a neutral, clearly stated assumption only when the user permits it.
4. Never present an example as a binding rule.

Update rules here first. If a workflow changes, update the relevant skill after the rule change has been reviewed.

## Evidence precedence

Approved requirements and instructions take precedence over examples. Curated examples may support a candidate pattern but do not become policy automatically. Project-specific conventions remain scoped to their project unless they pass the generalization test in `standard-derivation-rules.md`.
