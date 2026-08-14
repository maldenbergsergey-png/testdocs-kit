---
name: generate-test-cases
description: Generate new QA test cases from user-supplied requirements, analysis, API examples, documentation, or optionally retrieved context. Use when a user asks to draft, create, or derive test cases; do not use for updating an existing case or for coverage classification alone.
---

# Generate test cases

Create new test cases from available context and return them in chat by default.

## Read the source of truth

Before drafting, read:

- [`../../rules/test-case-standard.md`](../../rules/test-case-standard.md)
- [`../../rules/test-case-type-rules.md`](../../rules/test-case-type-rules.md)
- [`../../rules/coverage-rules.md`](../../rules/coverage-rules.md) when deciding scenario boundaries or persistent value
- [`../../rules/coverage-matrix-rules.md`](../../rules/coverage-matrix-rules.md) when a matrix exists or matrix placement is requested
- [`../../rules/regression-model-rules.md`](../../rules/regression-model-rules.md) when the cases are intended for a regression model
- [`../../rules/test-case-lifecycle-rules.md`](../../rules/test-case-lifecycle-rules.md) when preparing TMS-ready output
- [`../../rules/reusable-setup-rules.md`](../../rules/reusable-setup-rules.md) when data or content preparation is shared, performed through an administration interface, or consumed by dependent cases
- [`../../rules/integration-rules.md`](../../rules/integration-rules.md) when Jira, Confluence, TMS, or another external source is referenced
- [`../../rules/README.md`](../../rules/README.md) for placeholder handling

Do not copy rules into this skill or replace unresolved placeholders with invented policy.

## Accept input

Accept any useful combination of plain-language requirements, analysis, acceptance criteria, API examples, supporting documentation, or context retrieved through an available tool.

Do not require an issue key, Jira, Confluence, Zephyr, a TMS, or MCP.

When the user supplies an issue key, external page, or TMS reference, use [`../collect-test-context/SKILL.md`](../collect-test-context/SKILL.md) first. With no external reference, work directly from the supplied context and do not search an arbitrary connected project.

## Workflow

1. Restate the supplied scope and identify authoritative inputs.
2. Check for contradictions and for missing facts needed to produce executable, expected outcomes.
3. If missing context prevents a supported action or observable expected result, return `INSUFFICIENT_CONTEXT`, list the exact gaps, and stop before inventing behavior. If only a required TMS value, environment entry point, stable visible label, or cleanup policy is missing but a safe partial draft remains useful, keep the field explicitly unresolved, propose `Черновик`, and list what must be supplied before execution or review.
4. Build a scenario inventory from the supplied coverage matrix when available; otherwise map each supported initial state, action, and materially different outcome to its source.
5. Apply the coverage rules and exclude unsupported categories, duplicates, one-time checks, and scenarios without established persistent value. State exclusions in coverage notes.
6. Identify preparation shared by multiple scenarios. Draft it once as a reusable setup procedure with a named output; keep it inline when it is short and unique to one case.
7. When content is prepared through an administration interface, separate helper preparation from administration behavior under test. End the helper at the confirmed administration state, link every consumer to the setup output explicitly, and leave public visibility or use to the consuming scenario.
8. Select the supported case type and platform tag, then draft the smallest coherent cases that preserve repeatability, observability, diagnosis, and independence for regression use.
9. Apply the first-pass executability and minimum-sufficient-detail tests. Remove internal technical detail from UI cases unless it is an explicit, observable part of the required test layer.
10. Apply approved project vocabulary and supplied curated examples for style only when they do not conflict with shared rules. Do not generalize a convention from one example during generation.
11. Verify every action, datum, and expected result against the authoritative inputs.
12. Run the self-check below and simplify or split any case that fails it.
13. Separate facts from any explicitly permitted assumptions and flag unresolved rule placeholders.
14. Recommend `Готов к ревью` only when every required field is complete and the case has passed the skill's self-check; otherwise keep `Черновик` and list the gaps. Do not map the observed external values `Draft` or `Normal` without approved TMS mappings.
15. Return the cases and any setup procedures in a clear Markdown structure with traceability and regression-value notes.

## Self-check

Before returning a case, answer `yes` to each applicable question:

- Can a tester unfamiliar with the project identify the surface, role, starting point, and required data?
- Does every step name a findable action target and avoid hidden team knowledge?
- Does every expected result state an observable comparison criterion instead of generic success?
- Does the case contain one coherent scenario at the smallest useful regression boundary?
- Is internal technical detail absent unless the required test layer and approved observation surface justify it?
- Are reusable setup, consumed output, validity, and cleanup explicit without relying on case order?
- Can another tester repeat the case without using production secrets or personal data?
- Are all required TMS fields present under their approved names, with unresolved values shown explicitly rather than omitted?

## Output

For sufficient context, return:

```text
Scope
Assumptions and unresolved policy (if any)
Scenario inventory and source traceability
Reusable setup procedures (when needed)
  - Name and purpose
  - Required access and starting point
  - Input data
  - Actions with observable results
  - Output passed to dependent cases
  - Cleanup or validity boundary
Test cases
  - Title
  - Objective
  - Preconditions
  - Test data
  - Numbered steps with expected results
  - Type and platform tags
  - Priority rationale when evidence is supplied
  - Proposed lifecycle status
  - Path
  - Postconditions when applicable
Coverage notes
  - persistent regression value
  - relationship to supplied existing coverage
  - supported scenarios intentionally not made permanent
  - missing coverage evidence
Regression-model metadata (only when supplied or requested)
  - product area or journey
  - platform or test layer
  - scenario signature
  - traceability
  - supplied suite, labels, risk, and automation state
  - dependencies and constraints
  - reusable setup and consumed output
```

Use the field name `Objective`; do not substitute `Description`. For a partial draft, retain every required field and write `Unresolved — [missing input]` where a safe value cannot be derived. A case with an unresolved required field must not be proposed as `Готов к ревью`.

For insufficient context, return:

```text
Status: INSUFFICIENT_CONTEXT
Known context: ...
Missing information: ...
Why it is needed: ...
```

## Optional integrations and writes

Use an available read tool only when it supplies relevant context and the user has placed that source in scope. If no suitable tool is available, request the content manually instead of failing.

Show generated cases for human review before publication. Use an external write tool only when it is available and the user explicitly asks to publish the reviewed content. Do not perform destructive operations.
