# Regression model rules

**Status:** proposed organizational standard derived from the supplied instructions; pending human review.

A regression model is a traceable map of persistent coverage, not merely a folder or an accumulated list of cases. It connects stable product behavior to reusable cases and makes duplication, gaps, execution constraints, and maintenance decisions visible.

## Inputs

Build the model only from supplied evidence:

- active test cases or a scoped export;
- requirements, contracts, feature maps, or an authoritative coverage summary;
- known risk, criticality, usage, incident, and change information;
- approved meanings of statuses, labels, suites, and automation fields.

Use `coverage-matrix-rules.md` as the primary structural model when a matrix exists. Do not infer completeness solely from a folder name, workflow status, case count, or label frequency.

## Case eligibility

Include a case in persistent regression coverage when evidence supports that it is current, repeatable, observable, and valuable against recurring product risk. Exclude or flag:

- obsolete or one-time checks when their status is explicitly established;
- drafts whose intended behavior is not approved;
- cases whose setup, data, or expected behavior cannot be reproduced;
- exact duplicates and equivalent cases that add no distinct risk detection;
- implementation-only checks that are not an approved contract or diagnostic surface.

A reusable setup procedure is a dependency, not a regression scenario by itself. Count linked administration cases as administration-interface coverage only for the creation, update, deletion, validation, and other supported behavior each one actually asserts. Record shared-dependency concentration when failure of one setup procedure or administration creation/configuration case would block several otherwise independent cases.

Represent identical cross-page block logic with one base functional case linked to every applicable page. Represent a supported product-direction difference with a delta-only case that calls the base. Do not count copied base steps, repeated breakpoint cases, or isolated small-element cases as additional regression value.

Never remove or retire an existing case automatically. Record the evidence and propose a human-reviewed action.

## Coverage axes

Capture each axis when it is supplied or can be mapped without guessing:

- product area, feature, or user journey;
- platform, interface, or test layer;
- scenario and primary verification intent;
- initial-state or actor variant when behavior differs;
- requirement or contract traceability;
- risk or criticality evidence;
- suite, tier, label, and automation state with their approved meanings;
- setup, data, environment, integration, and execution-order constraints;
- reusable preparation procedures and their output and cleanup contracts;
- base-case, direction-variant, and administration-operation call relationships;
- current lifecycle status and ownership when available.

Use approved type and platform tags from `test-case-type-rules.md`, lifecycle meanings from `test-case-lifecycle-rules.md`, and the priority rules below. Do not invent automation classification.

## Scenario signature

Compare coverage using a behavioral signature:

```text
Test layer + initial state + trigger or action + observable outcome
```

Cases with the same signature may be duplicates even when their titles or data differ. Cases with different material outcomes are distinct even when they belong to the same feature. Treat parameterized variants as equivalent only when supplied evidence shows that the same case and expected behavior cover them adequately.

## Gap analysis

Identify a confirmed gap only by comparing the model with an authoritative set of intended behaviors or a scoped completeness statement. Absence from the case export alone is `INSUFFICIENT_CONTEXT`, not proof of missing coverage.

For every gap, record the uncovered behavior, supporting requirement, risk rationale, and recommended `CREATE` or `UPDATE` action. Do not generate full cases unless separately requested.

## Model levels

Use these priority levels:

- `High` — failure blocks a primary business process or materially affects revenue, entity creation, or a critical user path. Include in Smoke and Full Regression.
- `Medium` — important and frequently used functionality that affects user experience without fully blocking the system. Include in Full Regression and select for Smoke based on context.
- `Low` — secondary, rare, or non-critical behavior. Include in Full Regression and allow exclusion under time constraints.

The instruction defines the conceptual middle level as `Medium`, while the supplied Zephyr export uses `Normal` for 373 cases and contains no `Medium` value. Do not silently map `Normal` to `Medium` in external data until the team confirms the TMS mapping. Preserve the raw value and show the conceptual recommendation separately.

Recommended starting ranges by type:

| Type | Recommended priority |
| --- | --- |
| `e2e` | High |
| `overview` | High or Medium |
| `block` | High, Medium, or Low according to block criticality |
| `cross` | Medium or Low |
| `integration` | Medium or High when business logic is affected |

Type is not priority. Justify priority with business impact, usage frequency, criticality of the user path, change risk, and conversion impact. Use analytics when supplied. Do not assign a numeric score that the instructions do not define.

Every case must have a type tag, and type determines its place in regression and Smoke together with priority and project context. Preserve existing suite assignments when their evidence is unavailable.

## Maintenance decisions

Use the coverage categories from `coverage-rules.md` for additions and updates. For possible retirement, use `RETIRE_PROPOSAL` only when evidence shows that behavior is removed, coverage is truly equivalent elsewhere, or the check no longer has persistent value. Include the replacement relationship when applicable.

Reassess the affected slice of the model after requirement changes, incidents, major architecture changes, and case updates. Preserve unaffected mappings.

## Model record

```text
Case or gap identifier: ...
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
```

When organizational lifecycle values are available, show the raw TMS status alongside the normalized analytical lifecycle. Never normalize unresolved `Draft` automatically.

## Reuse across projects

Reuse the structure, scenario-boundary logic, and writing patterns of a high-quality case. Do not reuse product behavior, identifiers, URLs, credentials, exact data, labels, or expected results in another project unless that project's authoritative context independently supports them.
