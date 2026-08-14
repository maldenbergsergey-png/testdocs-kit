# Coverage rules

**Status:** proposed organizational baseline derived from the supplied instructions; pending human review.

Use this file to decide whether a change affects permanent test coverage. Record one outcome for each materially distinct scenario:

- `CREATE` — a valuable persistent scenario is not represented by supplied evidence of existing coverage.
- `UPDATE` — an existing case covers the scenario but no longer matches the intended behavior.
- `NO_CHANGE` — supplied evidence shows that permanent coverage remains adequate or the change does not justify a persistent case.
- `INSUFFICIENT_CONTEXT` — available evidence cannot support another decision.

## Decision inputs

Base a decision only on supplied evidence about:

- changed or intended observable behavior;
- affected user, business, API, data, permission, or failure paths;
- relevant existing cases or an authoritative coverage summary;
- product risk, recurrence, and execution context when available;
- whether the check is persistent, one-time, exploratory, or rollout-specific.
- the relevant scenario in the coverage matrix when a matrix exists.

Absence of an existing case from the prompt is not proof that no case exists. A `CREATE` decision requires either scoped confirmation that supplied coverage is complete for the affected area or an explicit statement that the scenario is uncovered.

## CREATE

Use `CREATE` when evidence supports all of the following:

- the scenario has a distinct initial condition, action, or materially different expected outcome;
- it verifies stable observable behavior rather than only an incidental implementation detail;
- recurrence or product impact gives the scenario persistent regression value;
- supplied coverage evidence establishes that no existing case adequately represents it;
- the expected behavior is defined well enough to create an executable case.

Identify the uncovered scenario and why it merits persistent coverage. Do not generate the full case unless separately requested.

## UPDATE

Use `UPDATE` when a supplied existing case has the same primary verification intent, but its supported preconditions, data, action, or expected result no longer matches the intended contract. Prefer a localized update when unaffected content remains valid.

Identify the existing case and affected portion. If the case cannot be identified or its current content is unavailable, use `INSUFFICIENT_CONTEXT` rather than reconstructing it.

Create a separate case instead when the change introduces an independent path whose setup or outcome would make the existing case ambiguous or difficult to diagnose.

For reusable setup, update the shared procedure when only its preparation actions change and its promised output remains equivalent. Propose consumer updates only when their reference, required input, starting state, cleanup ownership, or tested behavior is affected. Do not classify a helper-procedure change as new functional coverage by itself.

## NO_CHANGE

Use `NO_CHANGE` only when supplied evidence establishes at least one of these conditions:

- an existing case already covers an equivalent initial state, action, and expected behavior;
- the change preserves the observable contract and only modifies implementation;
- the verification is explicitly one-time, rollout-specific, or otherwise outside persistent coverage under supplied policy;
- permanent coverage would duplicate an existing parameterized or broader case without improving risk detection or diagnosis.

Explain the equivalence or exclusion evidence. Never use `NO_CHANGE` merely because no issue is obvious or because no existing case was supplied.

## Checklist or test-report-only checks

Keep a check outside permanent coverage when supplied context shows that it is tied to a one-time migration, temporary rollout state, short-lived telemetry inspection, exploratory charter, or other non-repeatable event. Recommend where to record it, but do not invent a team workflow.

Implementation-specific verification can still merit a persistent case when that interface is an approved contract or diagnostic surface. Do not reject it solely because it is technical.

## Regression value

Assess persistent regression value using supported evidence about:

- severity or business impact of failure;
- frequency or importance of the affected path;
- likelihood of recurrence or change;
- distinctness from existing coverage;
- stability and repeatability of the behavior;
- diagnostic value relative to execution and maintenance cost.

These factors guide rationale; they are not a numeric scoring formula. Do not invent priority, automation, smoke, or suite membership.

Use priority and suite selection rules from `regression-model-rules.md`. Automation-candidate criteria and retirement thresholds beyond the evidence rules here remain unresolved.

## INSUFFICIENT_CONTEXT

Use `INSUFFICIENT_CONTEXT` when a defensible decision depends on missing behavior, scope, risk, or existing-coverage evidence. List the exact missing inputs and do not guess a category.

## Decision record

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
