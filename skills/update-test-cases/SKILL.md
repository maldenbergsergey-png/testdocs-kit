---
name: update-test-cases
description: Propose read-only, reviewable changes to an existing QA test case using new requirements or context, including a reasoned diff and a complete proposed version. Use when a user asks to update, revise, or adapt existing cases; do not write the changes to an external system.
---

# Update test cases

Produce a proposal for human review. Do not treat the proposal as an applied change.

## Read the source of truth

Before proposing changes, read:

- [`../../rules/update-rules.md`](../../rules/update-rules.md)
- [`../../rules/test-case-standard.md`](../../rules/test-case-standard.md)
- [`../../rules/reusable-setup-rules.md`](../../rules/reusable-setup-rules.md) when the case consumes or provides shared preparation
- [`../../rules/integration-rules.md`](../../rules/integration-rules.md) when retrieving a source issue, knowledge page, case version, comment, or history
- [`../../rules/test-case-type-rules.md`](../../rules/test-case-type-rules.md) when type or decomposition is affected
- [`../../rules/test-case-lifecycle-rules.md`](../../rules/test-case-lifecycle-rules.md)
- [`../../rules/coverage-matrix-rules.md`](../../rules/coverage-matrix-rules.md) when hierarchy or scenario mapping changes
- [`../../rules/coverage-rules.md`](../../rules/coverage-rules.md) when deciding whether content belongs in this case
- [`../../rules/regression-model-rules.md`](../../rules/regression-model-rules.md) when the change affects regression-model mappings or dependencies
- [`../../rules/README.md`](../../rules/README.md) for placeholder handling

## Require input

Require both the current test-case content (and identifier or version when relevant) and the new requirement, behavior, or correction that motivates the change.

Accept either input manually or through available read tools. Do not require Jira, Confluence, Zephyr, a TMS, or MCP.

If either input is absent, contradictory, or too ambiguous for a safe diff, return `INSUFFICIENT_CONTEXT` with exact missing information. Do not reconstruct unseen content.

When an external issue or case reference is supplied, use [`../collect-test-context/SKILL.md`](../collect-test-context/SKILL.md) first to retrieve the current source and case version. Do not treat a request to check or propose an update as permission to change the TMS.

## Workflow

1. Establish the current case as the baseline and summarize the requested change.
2. Compare the baseline with the new context using the shared rules.
3. Preserve unaffected content and identify additions, modifications, removals, and unchanged parts.
4. Give a source-backed reason for every proposed change. Flag conflicts and unresolved placeholders.
5. Recheck the proposed case for a focused scenario, repeatable setup, observable results, and independence from transient data or execution order.
6. Recommend a split instead of expanding the baseline when the new behavior forms an independent regression scenario.
7. Present the proposal/diff before the complete proposed version.
8. Render the complete proposed version directly as Markdown in the exact Russian Zephyr format from `test-case-standard.md`, with separate `Шаг`, `Тестовые данные`, and `Ожидаемый результат` columns. Never wrap it in a fenced code block.
9. Label the result `ПРЕДЛОЖЕНИЕ — НЕ ПРИМЕНЕНО` and request human review.
10. Keep external update operations disabled. Even after approval, return the reviewed proposal in chat without editing, versioning, moving, linking, commenting on, or changing the status of the existing TMS case.

## Output

Start with `Статус: ПРЕДЛОЖЕНИЕ — НЕ ПРИМЕНЕНО`, the source case, reason, and missing information or conflicts. Then show `Предлагаемые изменения` as `ДОБАВИТЬ`, `ИЗМЕНИТЬ`, `УДАЛИТЬ`, and useful `ОСТАВИТЬ` items. Under `Полная предлагаемая версия`, render the actual case directly as Markdown. End with `Граница применения`, stating that no external changes were made and TMS update is unavailable.

Keep analysis outside the complete proposed case. Never combine an action, test data, and expected result in one line or cell.

Do not propose a complete rewrite without the specific justification required by `update-rules.md`. Never automatically delete a case from an external system.
