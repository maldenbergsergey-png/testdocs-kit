# Test case standard

**Status:** approved organizational standard.

Use this standard to create executable test cases from supported requirements. Regression membership is a separate decision: a case may be a permanent regression case, an unclassified requested case, or an explicitly task-scoped case outside the regression model. Every case must preserve the intent of the supplied requirement while avoiding accidental dependence on hidden knowledge or unsupported behavior.

Read [test-case-format.md](test-case-format.md) whenever drafting or rendering a complete case. Read [test-case-setup-rules.md](test-case-setup-rules.md) when a case configures an entity in administration or consumes such configuration; it owns property-specific hints and administration assertions. Read [reusable-setup-rules.md](reusable-setup-rules.md) when shared preparation or dependencies exist.

## First-pass executability

Apply [shared quality criteria](core.md#качество-всех-qa-артефактов). A tester unfamiliar with the project must be able to find the starting point, prepare the necessary role, state and data, perform the actions and compare the observable result. State dependencies and cleanup when they affect another run. Links support these instructions, not replace them.

## Source-field completeness

Before drafting cases from a requirement, issue, specification, form description, table, API schema, or administration page, make a lossless internal inventory of every explicitly defined field, control, tab, default, validation, visibility condition, permission, state, and constraint in the requested scope.

Account for every inventory item with exactly one disposition:

- `COVERED` — represented by a case, step, datum, precondition, or observable result;
- `EXCLUDED_WITH_REASON` — intentionally outside the requested scenario or persistent coverage, with a source-backed reason;
- `AMBIGUOUS` — the source names the item but does not define behavior needed for an executable assertion.

Do not silently omit an item and do not use “прочие поля” as a substitute for inventory. Do not mechanically create one case or one step per field: group related fields into the smallest coherent user scenario while preserving failure diagnosis. Put `AMBIGUOUS` items once under `Требуется уточнить`; never invent their behavior. Show the inventory or coverage ledger only when the user requests traceability or when an exclusion or ambiguity would otherwise be surprising.

## Title

Name the behavior and condition being verified. Make the title specific enough to distinguish the scenario without reading hidden context. Avoid vague verbs such as “check” and generic subjects such as “functionality.” Keep the title short and user-facing; do not put a URL, requirement summary, type, priority, or rationale in it.

Build the title from broad to narrow using a full stop between short segments:

```text
Страница или функция. Блок. Сценарий
```

The title must align with the coverage-matrix hierarchy and preserve its parent page and block. For integration cases, a direction such as `[Source] → [Target]: [Contract behavior]` may replace the page hierarchy when supported by the project structure. Omit unknown segments rather than inventing them.

## Objective and traceability

State only the concise verification purpose and the case boundary. Do not put review remarks, assumptions, coverage analysis, implementation commentary, change history, or a requirement retelling into `Цель`. When the supplied Jira issue, Confluence page, or another in-scope requirement contains relevant source or design links, append a compact `Материалы:` list inside `Цель`. Include the primary requirement link and every relevant linked requirement, design/mockup, API contract, or supporting document used to derive the case. Determine related designs from the supplied task, its linked Confluence pages, and other explicitly scoped sources; do not guess a design from visual similarity. Each item must identify its purpose and be clickable, for example `• [Требования: правила отображения FAQ](https://...)` or `• [Макет: состояние блока FAQ](https://...)`. Preserve the exact direct URL. In a Zephyr payload, represent the same label and URL as an actual rich-text hyperlink created by `Insert link` semantics.

Do not paste every URL found in the source. Exclude navigation, unrelated tasks, login pages, and links that did not influence the case. Do not invent a title or claim that a target was checked when it was unavailable. If the exact target cannot be identified from the source label or retrieved content, list it under `Требуется уточнить` instead of adding an unexplained URL. Dedicated TMS traceability relations may be populated as well, but they do not replace this human-readable materials list when relevant links are available.

If behavioral requirements are unavailable, label correctness as unverified rather than inferring intended behavior from an existing case alone.

## Preconditions

Include only access, initial state, data and preparation required for this scenario. Describe each condition once; do not repeat it in the first step unless the step tests the transition. Keep expected outcomes out of preconditions. Do not add generic conditions such as internet access unless they affect this check.

State the required role or permission without embedding credentials. When the initial data is prepared through an administration interface or another support surface, reference the reusable setup procedure and identify the output that the case consumes. Follow `reusable-setup-rules.md`.

## Test data

Identify data needed to reproduce the scenario in the `Тестовые данные` cell of the step where the tester uses it. Use concrete values when the value itself exercises a boundary or rule. Use clear symbolic or parameterized values when any value with stated properties is sufficient.

For a property configured through an administration interface, this cell may also contain a concise `ℹ️` setup or source hint tied to the current action. Apply [Подсказки и ссылки на настройку](test-case-setup-rules.md#подсказки-и-ссылки-на-настройку); the hint does not replace the action or its expected result.

- Never invent credentials, secrets, production records, or personally identifiable data.
- State the relevant property of data, such as “registered user” or “value above the upper boundary.”
- Keep generated identifiers and timestamps variable unless an exact value is behaviorally significant.
- Separate data variants when they produce materially different behavior or expected outcomes.
- Do not create a case-level test-data section. When one datum is reused, repeat a short reference in each step that consumes it or name it once in the first consuming step and use the same unambiguous name later.

Use only approved non-production data and environment references. When the supplied materials do not define safe data sources or masking, record the gap instead of inventing credentials.

## Tags

Assign at least one type tag and one platform tag according to `test-case-type-rules.md`. Add the application-area tag `админка` when the behavior under test is an administration interface. Multiple type tags are allowed only when each classification is supported. Do not infer tags from title wording alone.

## Path

For web cases, record the path relative to the domain. Put variable segments such as identifiers, codes, categories, and slugs in square brackets, for example `/news/[id]`.

For mobile application cases, record the user navigation path to the screen, for example `Catalog / Object card`. Align the path with the coverage matrix. Ask for the path when it cannot be derived from authoritative product structure.

## Postconditions

Describe cleanup or restoration required after execution, such as removing an entity created by the case. Include postconditions when side effects would make the next run unsafe, non-repeatable, or dependent on shared data.

## Scenario boundary

Keep one primary verification intent and one coherent path in a case. Split content when scenarios require different initial states, actions, or materially different outcomes, or when combining them would make a failure ambiguous.

Do not split mechanically when several assertions describe the same observable outcome of one action. Do not combine unrelated positive, negative, permissions, and boundary scenarios merely to reduce case count.

For a page implemented as visual or frontend blocks, use those blocks as the first decomposition level. Group small related elements—such as a heading, supporting text, icon, and adjacent control—inside one coherent block case instead of creating one-step cases for each element. When one block contains several substantial and independently diagnosable behaviors, split it into logical functional parts rather than keeping an oversized block case.

## Steps

Write numbered actions in execution order.

- Use the exact Markdown table header `| № | Шаг | Тестовые данные | Ожидаемый результат |` in chat and document output.
- Keep the action, data, and expected result in separate table cells.
- Put data consumed by the action and, when useful, its property-specific `ℹ️` setup/source hint in `Тестовые данные`; leave the cell empty when neither is needed.
- Format two or more independent items in one cell as a vertical bullet list. Preserve one item per line when sending the case to a TMS; do not flatten it into a comma- or semicolon-separated sentence.
- Name the action, its target and needed input using stable visible labels.
- Group routine input and confirmation actions when they lead to one result. Split when an intermediate state is itself tested or a failure would otherwise be unclear. Do not add a row merely to confirm that text was entered or a page opened.
- Include navigation only when it establishes required state or is part of the behavior under test.
- In an `overview` case, include scrolling or navigation only when the next block cannot otherwise be found.
- Do not rely on “as usual,” “if necessary,” “do everything required,” or hidden tester knowledge.
- Do not make an essential action depend only on “repeat step N”; restate a short action or call a named reusable setup procedure.
- Avoid interface coordinates, transient element positions, internal method names, or other implementation details unless the requirement makes them significant.

## Expected results

Describe the observable state, response, persisted effect, or externally visible side effect supported by the source. Pair a result with the action that causes it when this is needed for clear execution and diagnosis.

- State what is observed and, when relevant, where it is observed.
- Write the result in the present tense so it answers “What result is observed?”
- Use exact text, status, payload, or data only when the source defines it as part of the contract.
- Preserve all supported assertions that are needed to prove the scenario.
- Do not use “works correctly,” “successful,” or a restatement of the action without an observable criterion.
- Do not use “standard behavior,” “available for interaction,” or “matches the requirements/design” as the only result; state the essential observable behavior in text.
- Do not assert logs, database state, or internal calls unless those are approved verification surfaces for the case.
- Use screenshots and attachments as supporting evidence, not as the only definition of the expected behavior. When a screenshot is used, include the relevant design or documentation link and state the essential observable result in text.

## Technical detail

Describe behavior at the intended test layer. For UI, use visible controls and results; for API, retain the documented method, address, needed inputs, status and fields. Internal components, storage, logs and queues belong only to explicitly scoped checks with an approved observation method. Omit implementation explanations that do not help execute or assess the check; do not move them into another section just to retain them.

For administration cases that create or configure content for later use, apply [Создание и настройка сущности в админке](test-case-setup-rules.md#создание-и-настройка-сущности-в-админке). End with confirmation of the saved entity through the administration interface. API responses and downstream frontend behavior belong to separately scoped cases; knowledge of related endpoints does not add them to the creation scenario.

Technical detail is justified only when all three conditions hold:

1. the requirement or contract explicitly makes it part of the verification scope;
2. the intended tester has an approved way to observe it;
3. it improves diagnosis without making the case dependent on incidental implementation.

## Shared blocks and variant cases

When the same block appears on several pages with identical logic, create one base functional `block` case for its shared functional and supported non-functional behavior. Link that case to every applicable page or entry point in the coverage model; do not duplicate its full steps per page.

When a product direction, theme, object type, or other supported variant changes only part of the block:

- retain the base case for common behavior;
- create a separate variant case only for the defined differences;
- make the first step or called step a clickable reference to the base functional case;
- after the call, assert only variant-specific behavior;
- do not create a variant case when no difference is supported by the source.

Apply named product directions only from explicitly scoped current-project context under `project-conventions.md`; do not store or generalize project names in the shared standard.

## Desktop scope and breakpoint exclusions

For persistent web UI test cases, use the primary desktop breakpoint by default. Do not add steps or separate permanent cases that verify the same content at multiple resolutions, responsive breakpoints, viewport widths, or device-size variants unless a later approved rule or an explicit user request changes this policy.

Breakpoint and resolution checks may remain in a task checklist when they are relevant to the current implementation, but they are not promoted into the regression test cases governed by this standard. Do not infer mobile or adaptive coverage from the desktop case.

## Regression reusability

A case is suitable for persistent regression coverage when supplied evidence shows that the behavior is stable enough to repeat, meaningful to product risk, and not adequately represented by existing coverage.

For reusable regression cases:

- describe stable behavior rather than a one-time rollout or migration procedure;
- avoid build numbers, temporary environment names, and transient issue states unless parameterized or behaviorally required;
- make setup and cleanup needs explicit when they affect repeatability;
- avoid dependence on execution order and shared mutable data where practical;
- prefer the smallest case that still proves the behavior and supports useful failure diagnosis;
- record source traceability and known coverage relationships outside prose when the target system supports them.

Assign type, priority, and regression membership only through their approved rule files. Automation status must not be invented.

## Positive, negative, and boundary scenarios

Derive scenarios from requirements, contracts, risk, and known failure modes. Include negative and boundary cases when the supplied behavior defines rejection, limits, permissions, validation, recovery, or other meaningful alternatives. Do not generate categories mechanically without a supported expected outcome.

## Readability and style

Apply the shared [output language and punctuation rules](core.md#язык-и-оформление-результатов) to case prose, including short hyphens and double quotation marks.

Use the authoritative context's terms and the shared quality check. Keep approved project vocabulary scoped to its project.

For Russian-language cases, use a consistent neutral pattern unless an approved project style says otherwise:

- write actions in the infinitive, for example `Открыть`, `Перейти`, `Выбрать`, `Нажать`, `Ввести`, or `Проверить`;
- write results in the present tense, for example `Открывается`, `Отображается`, `Сохраняется`, or `Выполняется переход`;
- prefer neutral terms such as `Нажать` and `Прокрутить` over colloquial variants when the distinction is not behaviorally important;
- keep product labels in their source spelling and quote visible UI text when exact identification is needed.

Use the output language requested by the user or established by the project. The supplied organizational corpus uses Russian for case prose and preserves product labels in their source spelling. Punctuation and accessibility conventions not defined in the supplied instructions remain unresolved.

## Prohibited constructions

Do not include:

- invented requirements, identifiers, behavior, data, or existing coverage;
- vague actions or results that require hidden knowledge;
- unsupported assertions or technical verification surfaces;
- unrelated scenarios bundled into one case;
- production secrets or personal data;
- accidental dependence on another case, a temporary environment, or an execution order;
- stylistic imitation that preserves a known defect or contradicts an approved rule.
- silent omission of a source-defined field, control, state, default, validation, or constraint from both coverage and the explicit gap list.

## Unresolved-policy fallback

When a requested case depends on an unresolved placeholder, identify the gap after the case in a compact `Требуется уточнить` list. Do not repeat the gap in several sections or add speculative rationale. Use only facts and conventions present in the supplied context.

Do not produce a ready case when the missing fact changes the actions or observable result, for example an unknown sort direction, validation rule, transition target, or permission outcome. Ask for the fact or omit that scenario from the ready set. When a safe partial draft remains useful, use `Не определён` only in the affected metadata field and keep status `Черновик`.
