---
name: generate-test-cases
description: Generate new QA test cases from user-supplied requirements, analysis, API examples, documentation, or optionally retrieved context, and create them in a connected TMS only when the user explicitly requests publication. Use when a user asks to draft, show, create, publish, or derive new test cases; do not use for updating an existing case or for coverage classification alone.
---

# Generate test cases

Create new test cases from available context and return them in chat by default.

## Read the source of truth

Before drafting, read:

- [`../../rules/test-case-standard.md`](../../rules/test-case-standard.md)
- [`../../rules/test-case-type-rules.md`](../../rules/test-case-type-rules.md)
- [`../../rules/coverage-rules.md`](../../rules/coverage-rules.md) when deciding scenario boundaries or persistent value
- [`../../rules/coverage-matrix-rules.md`](../../rules/coverage-matrix-rules.md) when a matrix exists or matrix placement is requested
- [`../../rules/regression-model-rules.md`](../../rules/regression-model-rules.md) when the cases are intended for a regression model
- [`../../rules/test-case-lifecycle-rules.md`](../../rules/test-case-lifecycle-rules.md) when preparing TMS-ready output
- [`../../rules/reusable-setup-rules.md`](../../rules/reusable-setup-rules.md) when data or content preparation is shared, performed through an administration interface, or consumed by dependent cases
- [`../../rules/integration-rules.md`](../../rules/integration-rules.md) when Jira, Confluence, TMS, or another external source is referenced
- [`../../rules/project-conventions.md`](../../rules/project-conventions.md) when the supplied context concerns an MR direction or another convention defined there
- [`../../rules/README.md`](../../rules/README.md) for placeholder handling

Do not copy rules into this skill or replace unresolved placeholders with invented policy.

## Accept input

Accept any useful combination of plain-language requirements, analysis, acceptance criteria, API examples, supporting documentation, or context retrieved through an available tool.

Do not require an issue key, Jira, Confluence, Zephyr, a TMS, or MCP.

When the user supplies an issue key, external page, or TMS reference, use [`../collect-test-context/SKILL.md`](../collect-test-context/SKILL.md) first. With no external reference, work directly from the supplied context and do not search an arbitrary connected project.

Determine the requested coverage mode before generation:

- `REQUESTED_CASES` — default for a direct generate-only request; produce the supported requested cases without claiming regression membership;
- `PERMANENT_COVERAGE` — only when called from the full-package workflow or the user explicitly requests regression/persistent coverage;
- `TASK_SCOPED` — when the user explicitly asks for cases only for the current task or outside the regression model; include supported one-time scenarios and keep them outside permanent coverage.

## Workflow

1. Identify the supplied scope and authoritative inputs internally; do not repeat this analysis before the cases unless the user requests it.
2. Check for contradictions and for missing facts needed to produce executable, expected outcomes.
3. If missing context prevents a supported action or observable expected result, return `INSUFFICIENT_CONTEXT`, list the exact gaps, and stop before inventing behavior. If only a required TMS value, environment entry point, stable visible label, or cleanup policy is missing but a safe partial draft remains useful, keep the field explicitly unresolved, propose `Черновик`, and list what must be supplied before execution or review.
4. Build a lossless source-field and source-link inventory before the scenario inventory. Account internally for every field, control, default, validation, visibility condition, permission, state, constraint, and relevant requirement/design/supporting link as `COVERED`, `EXCLUDED_WITH_REASON`, or `AMBIGUOUS` according to `test-case-standard.md`.
5. Build a scenario inventory from the supplied coverage matrix when available; otherwise map each supported initial state, action, and materially different outcome to its source. Group related source fields into coherent user scenarios instead of creating one case per field.
6. Apply permanent coverage decisions only in `PERMANENT_COVERAGE`. In `REQUESTED_CASES`, generate the supported requested scope and leave regression membership unclassified. In `TASK_SCOPED`, allow supported task-specific and one-time scenarios and explicitly keep them outside the regression model. In every mode, remove unsupported behavior and accidental duplicates. Explain exclusions only when requested or surprising.
7. Identify blocks reused with identical logic across pages. Draft one base functional case and link it to every applicable page instead of duplicating the steps.
8. Identify supported direction, theme, object-type, or presentation differences. Draft a delta-only variant case whose first called step links the base functional case; do not repeat common steps or create variants without a supported difference. Apply scoped names such as MR directions only through `project-conventions.md`.
9. When a user-facing entity is configured through an administration interface, draft one coherent administration case per supported operation: creation, update, and deletion. Split an oversized operation into numbered `Админка. [Раздел или сущность]. [Операция]. Этап N. [Сценарий]` cases only when genuinely staged. Give every administration case the `админка` tag.
10. Make the linked administration creation/configuration case or reusable setup the first step/called step of every functional consumer. Use an actual clickable TMS link and state the output consumed. The tester executes it when a conforming entity is absent and deliberately skips it when one already exists. Keep update and deletion as separate coverage and keep pure helper preparation for contexts that do not support assertions about administration behavior.
11. Select the supported case type and platform tag, then draft the smallest coherent executable cases that preserve repeatability, observability, and diagnosis. Require long-term regression independence only in `PERMANENT_COVERAGE`. Group small related page elements inside one block case and split a large block only by meaningful functional parts.
12. Apply the first-pass executability and minimum-sufficient-detail tests. Remove internal technical detail from UI cases unless it is an explicit, observable part of the required test layer.
13. For permanent web UI cases, use the primary desktop breakpoint and omit resolution, viewport, and repeated breakpoint checks. Task-scoped breakpoint checks belong in a checklist by default; include them as task-only cases only when the user explicitly requests that format.
14. Apply approved project vocabulary and supplied curated examples for style only when they do not conflict with shared rules. Do not generalize a convention from one example during generation.
15. Verify every action, datum, and expected result against the authoritative inputs.
16. Reconcile the final cases against the source-field and source-link inventories. Keep `Цель` concise and add relevant links as named clickable Markdown links in its `Материалы` block. Do not return or publish while an item is unaccounted for. Put `AMBIGUOUS` items in `Требуется уточнить`; keep exclusions internal unless requested or surprising.
17. Run the self-check below and simplify or split any case that fails it.
18. Do not use assumptions to complete behavior. Put material gaps once in a short `Требуется уточнить` block after the cases.
19. Recommend `Готов к ревью` only when every required field is complete and the case has passed the skill's self-check; otherwise keep `Черновик` and list the gaps. Do not map the observed external values `Draft` or `Normal` without approved TMS mappings.
20. Return reusable setup when needed, then the test cases in the exact Russian Zephyr format from `test-case-standard.md`. Render the fields and tables directly as Markdown, never as a fenced text/code block. For `TASK_SCOPED`, add one compact note before the cases: `Область покрытия: только текущая задача; не включать в постоянную регрессионную модель.` Keep the default response limited to executable content.

## Self-check

Before returning a case, answer `yes` to each applicable question:

- Can a tester unfamiliar with the project identify the surface, role, starting point, and required data?
- Does every step name a findable action target and avoid hidden team knowledge?
- Does every expected result state an observable comparison criterion instead of generic success?
- Does the case contain one coherent scenario at the smallest useful boundary for the requested coverage mode?
- Are identical shared blocks covered once, with direction-specific cases limited to supported differences and linked to the base case?
- Is each administration operation grouped into one case where practical, is the creation/configuration case linked as the first dependency, and does every administration case have `админка`?
- Are small related elements grouped and oversized blocks split only by meaningful functional parts?
- Is internal technical detail absent unless the required test layer and approved observation surface justify it?
- Are reusable setup, consumed output, validity, and cleanup explicit without relying on case order?
- Can another tester repeat the case without using production secrets or personal data?
- Are all required TMS fields present under their approved names, with unresolved values shown explicitly rather than omitted?
- Is every source-defined field, control, default, validation, visibility condition, permission, state, and constraint covered, explicitly excluded with a reason, or listed as ambiguous?
- Is `Цель` concise and free of review/change commentary?
- Does `Цель` include every relevant source and design link as a named clickable link, without unrelated or unexplained URLs?
- Are all Zephyr field labels Russian and in the mandatory order?
- Does every step use separate `Шаг`, `Тестовые данные`, and `Ожидаемый результат` cells without an arrow or mixed sentence?
- Are multiple fields, values, or assertions inside one cell rendered as a vertical bullet list instead of a comma- or semicolon-joined paragraph?
- Is `Тестовые данные` empty rather than filled with `Не требуются` when a step consumes no data?
- Is there no separate case-level `Тестовые данные` section?
- Is the case rendered directly as Markdown rather than inside a fenced code block?
- Is the response free of analysis scaffolding and priority rationale that the user did not request?
- Are breakpoint and resolution checks absent from permanent cases, with desktop used as the default web UI context?

## Output

For sufficient context, return only `Переиспользуемая подготовка` when needed, `Тест-кейсы`, and `Требуется уточнить` only when a safe partial result contains material gaps.

Render every setup step and test step directly as a Markdown table with exactly four columns:

| № | Шаг | Тестовые данные | Ожидаемый результат |
| --- | --- | --- | --- |

Never wrap an actual case or its table in a fenced block. For several cases, separate them with Markdown headings such as `### Кейс 1`, while keeping every field and table directly rendered.

Inside a Markdown table cell, render two or more independent items with `<br>•`, for example `Заполнить поля:<br>• «Название»<br>• «Сортировка»`. When publishing through the bundled TMS tool, send the equivalent text with one `•` item per newline; the adapter converts it to visible Zephyr line breaks. Omit `testData` entirely when unused and never send `Не требуется` or `Не требуются` as its value.

Render every complete or partial test case using the exact field names and order defined under `Обязательный формат Zephyr` in `test-case-standard.md`. Never use `Name`, `Objective`, `Preconditions`, `Steps`, `Expected result`, `Type / Platform`, `Lifecycle status`, `Scope`, `Assumptions`, `Scenario inventory`, or `Coverage notes` as output labels.

Use `Не определён` for unsupported metadata only when the rest of the case remains safely executable. Do not add a priority rationale unless the user explicitly requests it. A case with unresolved actions or expected behavior is not a ready draft: omit it and list the exact missing fact under `Требуется уточнить`. A partial case must remain `Черновик`.

Return scenario inventory, source traceability, coverage analysis, regression-model metadata, or selection rationale only when the user explicitly requests those artifacts. Keep them outside test-case bodies.

For insufficient context, return:

```text
Status: INSUFFICIENT_CONTEXT
Known context: ...
Missing information: ...
Why it is needed: ...
```

## Optional integrations and writes

Use an available read tool only when it supplies relevant context and the user has placed that source in scope. If no suitable tool is available, request the content manually instead of failing.

When the user asks only to draft, generate, show, or prepare cases, return them in chat and do not write externally.

When the user explicitly asks in the same request to create or publish the new cases in the TMS, that request authorizes creation without a second confirmation. Before calling a create tool, verify the exact target instance, TMS product, project key, existing folder path (or explicit root), complete case content, a concise source-backed change comment, and fully reconciled source-field and source-link inventories. Do not publish from a truncated source or while an in-scope item is unaccounted for. Do not guess raw TMS status, priority, custom-field values, or folder paths. Do not send the Russian presentation value `Черновик` as a raw API status unless that mapping is confirmed; omit unmapped optional values and let the TMS apply its configured default. Send named Markdown links so the adapter creates Zephyr rich-text links. Record the concise comment through a supported TMS comment capability; if comments are unavailable, report that the content write and required audit comment are separate results and do not place the comment in `Цель`. After creation, return each created case as a clickable key using the full URL returned by the connector, plus the target folder. Do not invent a case URL when the connector did not return one.

Creation permission applies only to new cases. Route any later correction or existing-case apply request to `update-test-cases`; do not update it inside this generation workflow.
