---
name: generate-test-cases
description: Generate new QA test cases from user-supplied requirements, analysis, API examples, documentation, or optionally retrieved context, and create them in a connected TMS only when the user explicitly requests publication. Use when a user asks to draft, show, create, publish, or derive new test cases; do not use for updating an existing case or for coverage classification alone.
---

# Generate test cases

Create new test cases from available context and return them in chat by default.

Read [the common contract](../../rules/core.md) once per task. Follow conditional rule links only when their condition applies.

## Read the source of truth

Before drafting, read:

- [`../../rules/test-case-standard.md`](../../rules/test-case-standard.md)
- [`../../rules/test-case-type-rules.md`](../../rules/test-case-type-rules.md)
- [`../../rules/coverage-rules.md`](../../rules/coverage-rules.md) only in `PERMANENT_COVERAGE` or when the user explicitly requests coverage classification
- [`../../rules/coverage-matrix-rules.md`](../../rules/coverage-matrix-rules.md) when a matrix exists or matrix placement is requested
- [`../../rules/regression-model-rules.md`](../../rules/regression-model-rules.md) when the cases are intended for a regression model
- [`../../rules/test-case-lifecycle-rules.md`](../../rules/test-case-lifecycle-rules.md) when preparing TMS-ready output
- [`../../rules/reusable-setup-rules.md`](../../rules/reusable-setup-rules.md) when data or content preparation is shared, performed through an administration interface, or consumed by dependent cases
- [`../../rules/integration-rules.md`](../../rules/integration-rules.md) when retrieving external context or inspecting a live product/supplied media; follow "Live product context"
- [`../../rules/project-conventions.md`](../../rules/project-conventions.md) when the supplied context contains any company- or project-specific convention

Do not copy rules into this skill or replace unresolved placeholders with invented policy.

## Accept input

Accept requirements, analysis, acceptance criteria, API examples, documentation, and user-scoped web/Android/iOS screens or recordings/screenshots under "Live product context" in `integration-rules.md`.

Do not require an issue key, Jira, Confluence, Zephyr, a TMS, or MCP.

When source content behind an issue key, external page, or TMS reference needs retrieval, use [`../collect-test-context/SKILL.md`](../collect-test-context/SKILL.md) first. With no external reference, work directly from the supplied context and do not search an arbitrary connected project.

Determine the requested coverage mode before generation:

- `REQUESTED_CASES` — default for a direct generate-only request; produce the supported requested cases without claiming regression membership;
- `PERMANENT_COVERAGE` — only when called from the full-package workflow or the user explicitly requests regression/persistent coverage;
- `TASK_SCOPED` — when the user explicitly asks for cases only for the current task or outside the regression model; include supported one-time scenarios and keep them outside permanent coverage.

## Workflow

1. Establish authoritative scope and the coverage mode above. Build the source-field/link inventory and scenario inventory under [the case standard](../../rules/test-case-standard.md). Preserve every in-scope item through `COVERED`, `EXCLUDED_WITH_REASON`, or `AMBIGUOUS`; do not summarize away unread fields or links.
2. Resolve conflicts and missing behavior before drafting affected scenarios. Return supported independent cases when possible. If no executable case is supported, return `INSUFFICIENT_CONTEXT` with the exact missing facts and why they are needed.
3. Apply the standard's scenario boundaries, shared blocks, variants and permanent desktop scope. For configured content, load its setup/administration rules before drafting dependencies or cases. Apply supplied project conventions without generalizing from examples.
4. Draft the minimum sufficient cases. In `PERMANENT_COVERAGE`, use supported coverage decisions; in `REQUESTED_CASES`, leave regression membership unclassified; in `TASK_SCOPED`, include supported one-time checks and keep them outside permanent coverage.
5. Reconcile the complete result against the source inventory, first-pass executability and prohibited constructions in the standard. Apply lifecycle readiness only after those checks. Unresolved metadata may produce a clearly marked partial draft; unresolved actions or expected behavior cannot produce a ready case.
6. Render using [the output format](../../rules/test-case-format.md). Return only reusable setup when needed, cases and material questions. For `TASK_SCOPED`, precede them with: `Область покрытия: только текущая задача; не включать в постоянную регрессионную модель.` Keep inventories, analysis and selection rationale internal unless requested.

## Requested publication

For an explicit request to create/publish new cases, finish the complete reviewable payload first, then apply [external write rules](../../rules/external-write-rules.md) and the selected TMS profile. Confirm the exact target, reconcile all source items and use only supported field mappings. Report each returned case key as a clickable URL and the target folder; report any unavailable audit comment separately.

Any subsequent correction uses [update-test-cases](../update-test-cases/SKILL.md). Creation intent never authorizes updates to other cases.
