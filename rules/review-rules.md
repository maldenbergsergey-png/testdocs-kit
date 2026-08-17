# Review rules

**Status:** proposed organizational baseline derived from the supplied instructions; pending human review.

Review against approved rules and supplied requirements. Do not treat personal preference, corpus frequency, or an example as policy.

## Review dimensions

- **Traceability:** every asserted behavior is supported by a supplied requirement, contract, defect, or approved instruction. Missing requirements limit behavioral-correctness review.
- **Clarity:** the title, initial state, actions, data, and outcomes identify the scenario without hidden knowledge or ambiguous wording.
- **First-pass executability:** a competent tester unfamiliar with the project can identify the entry point, required role and state, actions, and comparison criteria without oral guidance or reconstructing the case from links and screenshots.
- **Minimum sufficient detail:** the case contains every detail needed to avoid a real execution choice while excluding implementation explanation and redundant visible information.
- **Completeness:** all information needed to execute the stated scenario and observe its supported outcome is present; unrelated coverage is not required inside the same case.
- **Scenario focus:** the case has one primary verification intent and one coherent path. Independent initial states or materially different outcomes are split when combining them harms diagnosis.
- **Step atomicity:** each step is attributable enough to execute and diagnose. Multiple mechanical actions may remain together when they form one inseparable interaction and have one outcome.
- **Expected-result correctness:** results are observable, attributable to the triggering action, and supported by authoritative context.
- **Technical detail:** the case includes only detail required by its intended test layer and approved verification surfaces.
- **Reusable setup:** preparation dependencies are explicit, return a defined output, and do not hide the behavior under test or rely on execution order.
- **Reusability:** the case avoids hidden order, transient data, temporary environments, and incidental implementation details that prevent repeated regression execution.
- **Data safety:** test data is explicit enough to reproduce the scenario and contains no invented secrets, production records, or personal data.
- **General rule compliance:** the case follows all other applicable approved files under `rules/`.
- **TMS completeness:** the case uses the exact Russian Zephyr fields and order from `test-case-standard.md`; step-level test data and postconditions are explicit even when they are `Не требуются`.
- **Step/data/result separation:** every numbered row has separate `Шаг`, `Тестовые данные`, and `Ожидаемый результат` columns; a case-level test-data section, an arrow, or a combined action/result sentence is a format defect.
- **Chat rendering:** a generated or fully proposed case is rendered as Markdown, not enclosed in a fenced code block that prevents the steps table from displaying normally.
- **Matrix alignment:** the name and path preserve the supplied page, block, structure, and scenario hierarchy.
- **Type fit:** `e2e`, `overview`, `block`, `cross`, or `integration` matches the case purpose and depth; step count outside the recommended range triggers a decomposition review, not automatic rejection.
- **Classification:** at least one supported type tag and one supported platform tag are present.
- **Priority:** High, Medium, or Low is supported by business and user-impact evidence and is not inferred from type alone.
- **Lifecycle:** the raw TMS status follows `test-case-lifecycle-rules.md`; restricted or unresolved statuses are reported without silent remapping.

## Finding format

Every confirmed issue must contain:

```text
Location: field or step identifier
Rule: repository rule and section
Problem: what does not conform
Why it matters: execution, coverage, maintenance, or interpretation impact
Recommendation: focused correction
```

Keep confirmed violations, unresolved-policy gaps, and optional suggestions separate. Recommendations should identify a focused correction without silently rewriting the complete case.

## Overall status

Use the neutral statuses:

- `PASS` — no rule-backed issues are found in the supplied review scope.
- `PASS_WITH_COMMENTS` — supported improvements are recommended, but the case remains executable and no issue prevents acceptance under current rules.
- `CHANGES_REQUESTED` — one or more rule-backed issues prevent reliable execution, observation, traceability, or safe reuse.
- `INSUFFICIENT_CONTEXT` — a reliable review requires missing requirements, current case content, field definitions, or approved policy.

When only behavioral requirements are missing, complete the structural review if possible and label behavioral correctness as unverified. Use `INSUFFICIENT_CONTEXT` as the overall status only when the missing information prevents a reliable decision on the requested review scope.

**PLACEHOLDER:** define finding severities and their blocking thresholds. Lifecycle and review-readiness statuses are governed separately by `test-case-lifecycle-rules.md`.

## Review boundaries

- Cite the applicable repository rule for each finding.
- Do not report a preference as a defect when the relevant policy is unresolved.
- State when requirements are unavailable and correctness cannot be assessed.
- Do not require positive, negative, or boundary scenarios without requirement or risk evidence.
- Treat vague results such as “standard behavior,” “works correctly,” or “matches the design” as findings when they do not state an observable comparison criterion.
- Treat UI assertions about API calls, database writes, or internal parameters as findings unless the technical surface is explicitly required, observable, and appropriate to the case layer.
- Treat English, mixed, missing, or reordered Zephyr field labels as findings unless the reviewed source is a legacy case and structural migration is explicitly outside the review scope.
- Treat analysis scaffolding embedded in a test case as a finding when it makes execution harder or duplicates TMS metadata.
- Do not fully rewrite a case when the user requested review only.
- Do not change or publish external data as part of review.
