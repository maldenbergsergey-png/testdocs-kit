# Coverage decision: CREATE

```text
Decision: CREATE
Scenario or affected area: Reject saving an item whose required name is empty.
Evidence: The requirement introduces required-field validation. The supplied coverage list contains only a valid-save case.
Rationale: A distinct negative behavior is persistent and is not represented in the supplied coverage.
Regression value: The validation protects a repeatable user path and provides a distinct failure signal from the valid-save case.
Target case: Not applicable.
Missing context: None for this architecture example.
Recommended next action: Draft a focused negative test case for human review.
```
