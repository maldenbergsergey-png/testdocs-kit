# Test case standard

**Status:** approved organizational standard.

Use this standard to create executable test cases from supported requirements. Regression membership is a separate decision: a case may be a permanent regression case, an unclassified requested case, or an explicitly task-scoped case outside the regression model. Every case must preserve the intent of the supplied requirement while avoiding accidental dependence on hidden knowledge or unsupported behavior.

## Обязательный формат Zephyr

Каждый новый или полностью предлагаемый к актуализации тест-кейс выводи в одном порядке и с русскими названиями полей:

**Название:** [краткое название пользовательского сценария]

**Цель:** [что проверяется]

Материалы:

- [назначение ссылки](https://example.test/source)

**Предусловия:**

- [необходимый доступ, состояние или подготовка]

**Путь:** [относительный web-путь или путь навигации в приложении]

| № | Шаг | Тестовые данные | Ожидаемый результат |
| --- | --- | --- | --- |
| 1 | [одно понятное действие] | [данные этого шага; оставить пустым, если они не нужны] | [наблюдаемый результат этого действия] |

**Постусловия:** [очистка/восстановление либо «Не требуются»]

**Теги:** `[тип]`, `[платформа]`

**Статус:** `Черновик`

**Приоритет:** [подтверждённое значение либо `Не определён`]

Названия `Название`, `Цель`, `Предусловия`, `Путь`, `Шаг`, `Тестовые данные`, `Ожидаемый результат`, `Постусловия`, `Теги`, `Статус` и `Приоритет` обязательны и не переводятся на английский. Порядок разделов обязателен. Отдельного раздела `Тестовые данные` в теле кейса нет: данные указываются только в одноимённой колонке нужного шага. Если данные шага не нужны, оставляй его ячейку `Тестовые данные` пустой — не заполняй её фразами `Не требуются`, `Нет` или `—`. Для ненужных постусловий по-прежнему используй `Не требуются`.

Блок `Материалы` является частью поля `Цель`, а не отдельным полем Zephyr. Добавляй его только при наличии релевантных ссылок; если таких ссылок нет, не выводи пустой заголовок или заглушку. Каждую ссылку оформляй как именованную кликабельную ссылку: слева — короткое назначение или название материала, справа — точный прямой URL. В чате используй Markdown `[назначение](полный URL)`. При записи в Zephyr Scale создавай rich-text link эквивалентно действию `Insert link`; не сохраняй URL как некликабельный текст и не используй ссылку без понятной подписи.

В таблице одна строка содержит ровно четыре отдельные колонки: номер, действие, тестовые данные и ожидаемый результат. Не соединяй действие с результатом стрелкой, тире, точкой с запятой или общей фразой в одной колонке. Не выноси ожидаемые результаты или тестовые данные в отдельный список после шагов.

Если одна ячейка содержит два и более самостоятельных элемента — например, несколько полей формы, набор значений или несколько наблюдаемых признаков результата — оформляй их вертикальным маркированным списком. В инструмент создания Zephyr/TM4J передавай каждый пункт с новой строки с маркером `•`; адаптер обязан преобразовать переносы в отображаемые TMS-разрывы строк. В Markdown-таблице используй `<br>•`, чтобы список сохранился внутри ячейки. Не склеивай перечисление запятыми или точками с запятой. Один короткий элемент оставляй обычной строкой; не создавай список ради оформления.

Пример одной строки в чате:

| № | Шаг | Тестовые данные | Ожидаемый результат |
| --- | --- | --- | --- |
| 1 | Заполнить поля:<br>• «Название»<br>• «Сортировка» | • Название: `Тестовый объект`<br>• Сортировка: `501` | • Значения отображаются в соответствующих полях<br>• Флаг «Активность» установлен по умолчанию |

В чате выводи кейс как обычную разметку Markdown. Не заключай весь кейс, его поля или таблицу шагов в тройные обратные кавычки и не используй fenced code block: таблица должна отрисоваться и быть пригодной для копирования по ячейкам.

По умолчанию пиши содержание кейса на русском языке. Видимые названия элементов интерфейса, продуктов и статусы сохраняй в исходном написании. Другой язык содержания используй только по прямому запросу пользователя, но названия полей Zephyr оставляй русскими.

Не добавляй в тело кейса служебные разделы `Scope`, `Assumptions`, `Scenario inventory`, `Coverage notes`, `Priority rationale`, `Lifecycle status` или аналогичные аналитические комментарии. Матрицу покрытия и регрессионные связи сохраняй в поддерживаемых полях TMS или показывай отдельно только по прямому запросу. Релевантные ссылки на требования и макеты являются исключением: их добавляй в `Цель` по правилам ниже.

## Core qualities

Every case must be:

- **traceable** — its behavior is supported by a supplied requirement, contract, defect, or approved instruction;
- **focused** — it has one primary verification intent and one coherent execution path;
- **repeatable** — another tester can recreate the initial state and actions;
- **observable** — expected results can be verified through the intended public interface or an approved diagnostic surface;
- **diagnosable** — a failed result identifies the affected behavior rather than only stating that something failed;
- **maintainable** — it excludes incidental detail that is likely to change without changing behavior;
- **self-explanatory** — a tester who has access but no prior project knowledge can find the starting point, perform the actions, and recognize the result from the case itself;
- **independent where practical** — it does not rely on hidden execution order or the side effects of another case.

## First-pass executability

Write for a competent tester who is unfamiliar with the project. Do not rely on oral explanations, team memory, or knowledge of where a feature is usually located.

The case is self-explanatory only when the tester can determine from it:

- which product surface and environment entry point to use;
- which role, access, state, and data are required;
- how to reach the first tested screen or operation;
- what action to perform at each step;
- what visible or otherwise approved result to compare with the actual result;
- what data or state must remain available for dependent scenarios.

Links to requirements and designs support the case but do not replace executable instructions. Do not force the tester to reconstruct the path or expected behavior from attachments when the essential information fits in the case.

Apply the minimum-sufficient-detail rule: include a detail when omitting it would create a real choice, ambiguity, or reproducibility problem; omit it when it merely explains the implementation or repeats an obvious visible state. Simplicity means low cognitive load, not missing setup or vague results.

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

Describe every condition and preparatory action that must be completed before execution, including relevant access, configuration, environment state, navigation, and existing data. Move setup that is not itself under verification into this field. Do not hide expected outcomes inside preconditions. Omit a precondition that is neither required nor supported by the source.

State the required role or permission without embedding credentials. When the initial data is prepared through an administration interface or another support surface, reference the reusable setup procedure and identify the output that the case consumes. Follow `reusable-setup-rules.md`.

## Test data

Identify data needed to reproduce the scenario in the `Тестовые данные` cell of the step where the tester uses it. Use concrete values when the value itself exercises a boundary or rule. Use clear symbolic or parameterized values when any value with stated properties is sufficient.

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
- Put only data actually consumed by the action in `Тестовые данные`; leave the cell empty when the action needs no input data.
- Format two or more independent items in one cell as a vertical bullet list. Preserve one item per line when sending the case to a TMS; do not flatten it into a comma- or semicolon-separated sentence.
- Begin each step with an unambiguous action.
- Include the target and necessary input or selection.
- Use the stable visible name of a section, field, or control when it is needed to find the target.
- Keep an action atomic enough that its result can be attributed and diagnosed.
- Make the step answer “What should be done?”
- Include navigation only when it establishes required state or is part of the behavior under test.
- In an `overview` case, explicitly show the visual transition to the next block being checked.
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

Choose detail according to the public behavior and intended test layer. UI cases may name stable visible controls; API cases may name the documented operation, request properties, status, and response contract. Include storage, logs, queues, or internal components only when they are explicitly in scope and observable to the intended tester.

Prefer behavioral language over implementation language. A refactor that preserves the observable contract should not require rewriting the case.

For UI and administration-interface cases, verify the state a tester can observe through that interface by default. Do not add HTTP methods, endpoints, database writes, internal parameter names, queues, jobs, or implementation flags merely to explain how the interface works. Move useful implementation context to a source note, or create a separate API or integration case when the technical contract itself is under test.

Technical detail is justified only when all three conditions hold:

1. the requirement or contract explicitly makes it part of the verification scope;
2. the intended tester has an approved way to observe it;
3. it improves diagnosis without making the case dependent on incidental implementation.

## Reusable setup and administration content

Use a reusable setup procedure when the same deterministic preparation is needed by multiple cases, especially when content or test data must be created, configured, or published through an administration interface. Keep the downstream case focused on the behavior it actually verifies.

A setup procedure is a dependency, not proof of product coverage. If the administration behavior is itself under test, create a focused administration-interface case instead of treating its verification as invisible setup. Apply `reusable-setup-rules.md` for the setup output, dependency, cleanup, and Zephyr mapping.

When a user-facing entity is configured through an administration interface, model its stable administration behavior with one coherent case per supported operation: one for creation, one for update, and one for deletion. Do not multiply cases by field or subsection inside the same operation. If one operation is too large or has independently diagnosable stages, split only that operation at those stage boundaries. Name split cases as `Админка. [Раздел или сущность]. [Операция]. Этап N. [Сценарий]` and preserve explicit links between the stages.

The user-facing functional case must use the linked administration creation/configuration case as its first step or called step. The step identifies the exact case by clickable TMS link and the output required by the functional scenario. If a suitable entity already exists and satisfies the stated starting conditions, the tester deliberately skips that preparation call and records or selects the existing entity; otherwise the linked administration case is executed. Do not copy its administration actions into every functional case. Update and deletion remain separate linked administration coverage and are not called as preparation when their result would invalidate the consumer's starting state.

Keep a pure helper procedure distinct from administration behavior under test. Use a helper instead of an administration regression case only when the relevant administration operation is outside the approved scope or no supported expected behavior is available. Every administration test case receives the additional `админка` tag.

## Shared blocks and variant cases

When the same block appears on several pages with identical logic, create one base functional `block` case for its shared functional and supported non-functional behavior. Link that case to every applicable page or entry point in the coverage model; do not duplicate its full steps per page.

When a product direction, theme, object type, or other supported variant changes only part of the block:

- retain the base case for common behavior;
- create a separate variant case only for the defined differences;
- make the first step or called step a clickable reference to the base functional case;
- after the call, assert only variant-specific behavior;
- do not create a variant case when no difference is supported by the source.

Apply any named product directions only through an explicitly scoped project convention such as `project-conventions.md`; do not generalize project names into the shared standard.

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

Use consistent terminology from the authoritative context. Prefer concise declarative wording, parallel step structure, and explicit observable outcomes. Define or avoid abbreviations that are not established in the supplied material.

Preserve an approved project vocabulary when writing for that project, but do not turn product names or local labels into universal rules.

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
