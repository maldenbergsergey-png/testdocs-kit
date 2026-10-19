# Standard derivation example

> Demonstration only. Sources and case identifiers illustrate the record format.

| Status | Proposed rule and benefit | Evidence | Scope and repository change |
| --- | --- | --- | --- |
| CONFIRMED | State an observable outcome instead of "works correctly" so another tester can compare results. | Supplied instruction "03. Правила заведения тест-кейсов", expected-results section; curated cases TC-EXAMPLE-1 and TC-EXAMPLE-2. | All test cases. Retain textual step-level outcomes in rules/test-case-standard.md; screenshots supplement them. |
| CONFIRMED | Keep the detail needed to find the starting point, act and compare the result without implementation knowledge. | Supplied organizational direction on simplicity; two independently reviewed Zephyr corpora. | UI and administration cases. Apply the executability check in rules/test-case-standard.md and review; API/integration cases retain their necessary technical contract. |
