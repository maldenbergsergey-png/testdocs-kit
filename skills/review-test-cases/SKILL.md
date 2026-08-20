---
name: review-test-cases
description: Review, optimize, or structurally refactor one or more QA test cases against shared standards and supplied requirements, returning status, located findings, rationale, recommendations, and complete corrected proposals when content changes are needed. Never write to the TMS during review.
---

# Review test cases

Review the supplied cases, report evidence-based findings, and include a complete corrected proposal when supported findings affect content. Do not change external data.

## Read the source of truth

Before review, read:

- [`../../rules/review-rules.md`](../../rules/review-rules.md)
- [`../../rules/test-case-standard.md`](../../rules/test-case-standard.md)
- [`../../rules/test-case-type-rules.md`](../../rules/test-case-type-rules.md)
- [`../../rules/test-case-lifecycle-rules.md`](../../rules/test-case-lifecycle-rules.md)
- [`../../rules/reusable-setup-rules.md`](../../rules/reusable-setup-rules.md) when a case uses shared preparation, administration content, or an execution dependency
- [`../../rules/integration-rules.md`](../../rules/integration-rules.md) when cases or requirements are retrieved externally
- [`../../rules/coverage-matrix-rules.md`](../../rules/coverage-matrix-rules.md) when a matrix or hierarchy is supplied
- [`../../rules/coverage-rules.md`](../../rules/coverage-rules.md) when coverage is explicitly in scope or a multi-case optimization may consolidate duplicates
- [`../../rules/regression-model-rules.md`](../../rules/regression-model-rules.md) only when regression-model suitability or suite structure is explicitly in scope
- [`../../rules/project-conventions.md`](../../rules/project-conventions.md) when a reviewed case uses any company- or project-specific convention
- [`../../rules/README.md`](../../rules/README.md) for placeholder handling

## Accept input

Accept one or more complete or partial test cases plus any requirements needed to assess behavioral correctness. Input may be pasted in chat, supplied as documents, or retrieved through optional read tools.

Do not require a specific TMS, MCP service, or integration. If content needed for a reliable review is unavailable, identify the gap rather than infer it.

When an external issue, page, or case reference is supplied, use [`../collect-test-context/SKILL.md`](../collect-test-context/SKILL.md) first. Review only the case version and requirement content actually retrieved.

## Workflow

1. Confirm the review scope and identify each case.
2. Distinguish structural, behavioral-correctness, and regression-reusability review based on the supplied requirements and scope.
3. Evaluate only against approved repository rules and explicit task context.
4. Record each issue at a precise field or step location, cite the rule section, explain impact, and recommend a focused correction.
5. Apply the first-pass executability test from the perspective of a competent tester unfamiliar with the project.
6. Check traceability, scenario focus, minimum sufficient detail, repeatability, observable outcomes, diagnostic value, transient dependencies, and hidden execution order.
7. When authoritative source content is supplied, build its field and link inventories. Verify that every in-scope item is covered, explicitly excluded with a reason, or identified as ambiguous, and that relevant requirement/design links appear as named clickable links in `Цель`. Report silent omissions without requiring one case per field.
8. Check the exact Russian Zephyr labels and field order, verify that there is no separate case-level test-data section, and verify that every step has separate `Шаг`, `Тестовые данные`, and `Ожидаемый результат` cells. An unused test-data cell must be empty, not filled with `Не требуются`.
9. When setup is reused, verify its named output, first-step consumer reference, conditional skip, validity, cleanup ownership, and separation from the tested behavior.
10. Check shared-block deduplication, delta-only direction cases, one-case-per-administration-operation grouping and `админка` tags, logical block decomposition, concise objectives, and absence of permanent breakpoint variants.
11. Separate confirmed problems from suggestions and from unresolved rule placeholders.
12. Assign the overall status defined in `review-rules.md` and summarize the most important findings.
13. Unless the result is `PASS`, apply supported content corrections to a complete proposed version in the exact Russian Zephyr format. Preserve unaffected content and label it as not applied.

For an explicit optimization or refactoring request across several cases, also compare the set as a whole. Propose one shared base case for identical block logic, delta-only direction cases, consolidation of mechanical duplicates, and logical splits for overloaded cases. Preserve every supported behavior, identify the source cases replaced by the proposed structure, and use `RETIRE_PROPOSAL` rather than deletion for confirmed duplicates. This remains a proposal and does not authorize external writes.

## Output

```text
Общий статус: PASS | PASS_WITH_COMMENTS | CHANGES_REQUESTED | INSUFFICIENT_CONTEXT
Область проверки: ...
Ограничения контекста: ...

Замечания
1. Место: ...
   Правило: ...
   Проблема: ...
   Почему это важно: ...
   Рекомендация: ...

Итог: ...

Полная исправленная предлагаемая версия
... (required when findings affect content)

Граница применения: внешние изменения не выполнялись.
```

State explicitly when no rule-backed issues are found. For `PASS`, do not invent a rewrite. For a partial case or unresolved behavior that prevents a safe complete proposal, state the exact gap instead of inventing content.

## Optional integrations

Use available read tools only to collect in-scope cases or requirements. If no suitable tool exists, ask the user to provide the material manually. Do not write, edit, publish, or delete external data during review.
