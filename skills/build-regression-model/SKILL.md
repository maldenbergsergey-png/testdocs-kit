---
name: build-regression-model
description: Build or assess a traceable regression coverage model from supplied test cases, Zephyr exports, requirements, coverage summaries, and risk context. Use when a user asks to organize a regression suite, map reusable cases to product areas, detect duplicates or gaps, classify persistent coverage, or propose regression-model maintenance. Produce a reviewable model and recommendations; do not invent suite meanings, delete cases, or publish changes automatically.
---

# Build regression model

Organize persistent test coverage into a maintainable, evidence-backed model.

## Read the source of truth

Before analysis, read:

- [`../../rules/regression-model-rules.md`](../../rules/regression-model-rules.md)
- [`../../rules/coverage-matrix-rules.md`](../../rules/coverage-matrix-rules.md)
- [`../../rules/test-case-type-rules.md`](../../rules/test-case-type-rules.md)
- [`../../rules/test-case-lifecycle-rules.md`](../../rules/test-case-lifecycle-rules.md)
- [`../../rules/coverage-rules.md`](../../rules/coverage-rules.md)
- [`../../rules/test-case-standard.md`](../../rules/test-case-standard.md) when case executability or reuse affects eligibility
- [`../../rules/reusable-setup-rules.md`](../../rules/reusable-setup-rules.md) when cases share preparation or administration content
- [`../../rules/integration-rules.md`](../../rules/integration-rules.md) when the model reads issues, requirements, or TMS data through an integration
- [`../../rules/README.md`](../../rules/README.md) for placeholder handling

For Zephyr Scale XML, use [`../derive-test-case-standard/scripts/summarize_zephyr_xml.py`](../derive-test-case-standard/scripts/summarize_zephyr_xml.py) to deduplicate keys and inspect lifecycle and field quality before modeling coverage.

## Accept input

Accept scoped case exports, test-case lists, requirements, feature maps, coverage summaries, risk information, and definitions of lifecycle statuses, labels, suites, and automation fields. Use manual files or optional authorized read integrations.

State which inputs are authoritative and whether the supplied case scope is complete. If status or label meanings are not supplied, preserve their raw values and mark their semantics unresolved.

Use [`../collect-test-context/SKILL.md`](../collect-test-context/SKILL.md) first when the request supplies external references. Confirm that the connected capability can read complete TMS cases rather than Jira issues alone.

## Workflow

1. Inventory sources, scope, versions, and known completeness.
2. Deduplicate cases by stable identifier and flag conflicting versions.
3. Map supplied lifecycle states using `test-case-lifecycle-rules.md`; preserve unresolved values such as `Draft` without guessing.
4. Create a behavioral signature for each eligible case.
5. Map supported product area, platform or layer, traceability, risk, suite metadata, dependencies, reusable setup outputs, and automation state.
6. Identify exact duplicates, probable equivalents, oversized cases, technical overload, unstable or highly concentrated setup dependencies, and missing execution information as review findings rather than silently changing cases.
7. Compare the model with authoritative intended behavior when available. Classify gaps using `coverage-rules.md`.
8. Recommend focused `CREATE`, `UPDATE`, `NO_CHANGE`, or `RETIRE_PROPOSAL` actions with evidence.
9. Return the model and limitations for human review. Do not rewrite, publish, or delete cases automatically.

## Output

```text
Status: MODEL_PROPOSAL — NOT APPLIED
Corpus and requirement scope: ...
Completeness and lifecycle assumptions: ...
Model dimensions and unresolved mappings: ...

Coverage model
1. Case or gap identifier: ...
   Lifecycle: ACTIVE | CANDIDATE | OBSOLETE | UNKNOWN | RETIRE_PROPOSAL
   Product area or journey: ...
   Platform or test layer: ...
   Scenario signature: ...
   Traceability: ...
   Regression value and risk evidence: ...
   Suite, tier, labels, automation: ...
   Dependencies and constraints: ...
   Reusable setup and output: ...
   Coverage relationships: ...
   Missing context: ...
   Recommended action: ...

Confirmed gaps: ...
Possible duplicates or overlaps: ...
Cases needing update or split: ...
Retirement proposals: ...
Model limitations: ...
Recommended next actions: ...
```

For a large corpus, summarize by product area and provide detailed records only for affected or problematic cases unless the user requests a full export.

## Optional integrations and writes

Use read tools only for sources in scope. Show the model proposal first. Apply changes or publish to an external system only after explicit review and a separate user request. Never delete an external case automatically.
