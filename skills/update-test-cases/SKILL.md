---
name: update-test-cases
description: Propose reviewable changes to an existing QA test case and, after an explicit apply request, safely update either a current-session-created case or a previously existing case using stale-proposal protection.
---

# Update test cases

Produce a proposal for human review by default. Apply a change only after an explicit request through the applicable registry or baseline-fingerprint guard.

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
- [`../../rules/project-conventions.md`](../../rules/project-conventions.md) when the case belongs to an MR direction or another convention defined there
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
7. Reconcile the proposed version against every in-scope source item and relevant source/design link; do not silently drop fields, constraints, or materials introduced by the correction context.
8. Recheck shared-block reuse, base/variant call links, one-case-per-administration-operation grouping and the creation/configuration first-step dependency, desktop-only regression scope, and logical block decomposition when applicable.
9. Draft a concise change comment stating what is added, changed, or removed and the task or requirement that caused it. Keep this comment outside `Цель`.
10. Present the proposal/diff before the complete proposed version.
11. Render the complete proposed version directly as Markdown in the exact Russian Zephyr format from `test-case-standard.md`, with separate `Шаг`, `Тестовые данные`, and `Ожидаемый результат` columns. Never wrap it in a fenced code block.
12. Label every proposal `ПРЕДЛОЖЕНИЕ — НЕ ПРИМЕНЕНО`. Store the connector-provided complete-baseline fingerprint for a possible later apply request, but do not expose internal hashes unless needed to diagnose a conflict.

## Apply an approved proposal to an existing case

When the user explicitly says to apply/update the exact case, re-read it through `zephyr_update_test_case`, passing the connector-provided baseline fingerprint and only the approved changed fields. If steps change, pass the complete final ordered list. The tool itself must re-read and reject stale content before PUT.

On conflict, do not write. Explain that another change invalidated the proposal, read the current version, and prepare a refreshed proposal for another human review. On success, show the returned key/URL and changed fields. Add the prepared concise change comment through a separately supported and authorized TMS comment capability. If comments are unavailable, report the missing audit comment separately; never move it into `Цель`. Never use the guarded content-update path itself for versions, folders, links, comments, lifecycle transitions, retirement, or deletion.

## Apply a correction to a just-created case

Apply the correction without a second confirmation only when all conditions hold:

1. The user explicitly asks to change the TMS case now, not merely to show or propose a revision.
2. The exact case key was returned by creation earlier in the same conversation.
3. The MCP tool itself confirms that the key belongs to the current running process; conversational memory is not sufficient.
4. The current case content and requested correction support a complete, safe final version.

Show the focused diff and final version, then call `zephyr_update_session_test_case`. When changing steps, pass the complete final ordered step list; the operation replaces the current step-by-step script. Pass only requested non-step fields so omitted fields remain unchanged. Report the changed fields and return the key as a clickable link using the full URL returned by the connector. Do not invent a case URL when the connector did not return one.

Preserve readable lists during correction: use `<br>•` inside Markdown table cells and send one `•` item per newline to the TMS. Do not flatten multiple fields, values, or expected assertions into one comma- or semicolon-separated paragraph.

If the MCP rejects the session key, use the guarded existing-case path only when a reviewed baseline fingerprint exists and the user explicitly asked to apply it. Otherwise return the normal proposal. Never bypass either guard.

## Output

For a proposal, start with `Статус: ПРЕДЛОЖЕНИЕ — НЕ ПРИМЕНЕНО`, the source case, reason, and missing information or conflicts. Then show `Предлагаемые изменения` as `ДОБАВИТЬ`, `ИЗМЕНИТЬ`, `УДАЛИТЬ`, and useful `ОСТАВИТЬ` items. Show the concise `Комментарий к изменению` outside the test-case fields. Under `Полная предлагаемая версия`, render the actual case directly as Markdown. End with `Граница применения`, stating that no external changes were made.

For an applied current-session correction, use the same focused diff and full final version, then end with `Применено`, the case key, and the fields changed. Do not claim that omitted fields were verified unless they were read.

Keep analysis outside the complete proposed case. Never combine an action, test data, and expected result in one line or cell.

Do not propose a complete rewrite without the specific justification required by `update-rules.md`. Never automatically delete a case from an external system.
