# Coverage decision: INSUFFICIENT_CONTEXT

```text
Decision: INSUFFICIENT_CONTEXT
Scenario or affected area: Changed item validation.
Evidence: The input says only "validation was updated."
Rationale: The former and intended validation behavior are not supplied, so CREATE, UPDATE, and NO_CHANGE cannot be distinguished safely.
Regression value: Cannot be assessed without the changed behavior and relevant existing coverage.
Target case: Unknown.
Missing context: Previous rule, new rule, affected inputs, and relevant existing cases or coverage summary.
Recommended next action: Ask the user to provide those facts manually or authorize retrieval through an available read integration.
```
