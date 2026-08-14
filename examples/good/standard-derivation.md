# Standard derivation example

```text
Status: CONFIRMED
Area: expected-result style
Candidate rule or pattern: Describe an observable state or response instead of saying that the feature works correctly.
Evidence: The supplied organizational instruction “03. Правила заведения тест-кейсов” requires an expected result for each step and asks “Какой результат наблюдаем?”; curated cases TC-EXAMPLE-1 and TC-EXAMPLE-2 pair actions with visible outcomes.
Scope: Project-independent test-case writing.
Rationale: The pattern makes execution and failure diagnosis repeatable across projects.
Conflict or limitation: Screenshots may supplement the result, but the reusable textual behavior still needs to be stated.
Proposed repository change: Keep the observable step-level outcome rule in `rules/test-case-standard.md`.
Expected effect: Generated and reviewed cases reject non-observable results and missing step-level expectations.
```

```text
Status: CONFIRMED
Area: simplicity and executability
Candidate rule or pattern: Use minimum sufficient detail so a competent tester unfamiliar with the project can reach the starting point, perform each action, and compare the actual result without internal implementation knowledge.
Evidence: The supplied organizational direction makes simplicity the primary criterion; two independent Zephyr corpora contain useful action/result wording as well as UI cases overloaded with long flows or API and database detail.
Scope: Project-independent UI and administration-interface cases.
Rationale: The rule improves onboarding, execution speed, and maintainability without removing information needed to reproduce the scenario.
Conflict or limitation: API and integration cases retain technical detail when the documented contract and approved verification surface require it.
Proposed repository change: Apply the first-pass executability and minimum-sufficient-detail checks in the test-case standard, generator, and reviewer.
Expected effect: Generated cases remain easy to follow, while corpus anti-patterns are not reproduced merely because they are frequent.
```
