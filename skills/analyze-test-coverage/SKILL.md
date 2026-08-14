---
name: analyze-test-coverage
description: Analyze how a supplied product or requirement change affects permanent QA test coverage and classify each scenario as CREATE, UPDATE, NO_CHANGE, or INSUFFICIENT_CONTEXT. Use for impact analysis and coverage decisions, not for automatically creating or editing test cases.
---

# Analyze test coverage

Assess permanent coverage without creating, changing, or publishing test cases.

## Read the source of truth

Before analysis, read:

- [`../../rules/coverage-rules.md`](../../rules/coverage-rules.md)
- [`../../rules/coverage-matrix-rules.md`](../../rules/coverage-matrix-rules.md) when a matrix exists or matrix impact is in scope
- [`../../rules/test-case-type-rules.md`](../../rules/test-case-type-rules.md) when scenario level affects the decision
- [`../../rules/regression-model-rules.md`](../../rules/regression-model-rules.md) when an existing regression model or suite relationship is in scope
- [`../../rules/test-case-standard.md`](../../rules/test-case-standard.md) only when existing case structure affects the decision
- [`../../rules/reusable-setup-rules.md`](../../rules/reusable-setup-rules.md) when a change affects shared data or administration preparation
- [`../../rules/integration-rules.md`](../../rules/integration-rules.md) when issue, knowledge, or TMS context is retrieved externally
- [`../../rules/README.md`](../../rules/README.md) for placeholder handling

## Accept input

Use supplied changed behavior, requirements, affected areas, risk information, and existing coverage evidence. Accept that context directly in chat, in accessible documents, or from optional read tools.

Do not require a particular tracker, TMS, issue key, or MCP service. Do not interpret missing case data as proof of missing coverage.

When the request supplies an issue key, external page, or TMS reference, use [`../collect-test-context/SKILL.md`](../collect-test-context/SKILL.md) first. A Jira-only connection cannot establish existing TMS coverage unless cases are actually retrieved.

## Workflow

1. Identify each materially distinct changed scenario by its initial state, action, and observable outcome.
2. Map supplied evidence about the scenario to existing cases or coverage summaries.
3. Apply the decision criteria in `coverage-rules.md`.
4. Assign exactly one supported category per scenario: `CREATE`, `UPDATE`, `NO_CHANGE`, or `INSUFFICIENT_CONTEXT`.
5. Identify whether the change modifies a reusable setup contract and list every supplied consuming case that may be affected.
6. Explain persistent regression value using available risk, recurrence, distinctness, stability, diagnostic value, and maintenance evidence without inventing scores or suite labels.
7. Explicitly distinguish facts, permitted assumptions, and unresolved rule placeholders.
8. Recommend the next human action without generating or editing cases automatically.

## Output

Return one decision record per scenario:

```text
Decision: CREATE | UPDATE | NO_CHANGE | INSUFFICIENT_CONTEXT
Scenario or affected area: ...
Evidence: ...
Rationale: ...
Regression value: ...
Target case (UPDATE only): ...
Missing context (when applicable): ...
Recommended next action: ...
```

- For `CREATE`, describe the valuable persistent scenario to create, not a complete case.
- For `UPDATE`, identify the existing case and affected portion. If it cannot be identified, use `INSUFFICIENT_CONTEXT`.
- For `NO_CHANGE`, explain the evidence that existing coverage is sufficient or that no permanent case is justified.
- For `INSUFFICIENT_CONTEXT`, list the exact missing inputs needed to decide.

## Optional integrations

Use suitable read tools only when available and relevant. If they are absent, ask the user to paste the requirement or coverage data. Never call a write tool as part of this skill.
