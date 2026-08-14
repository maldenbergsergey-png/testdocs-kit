---
name: build-coverage-matrix
description: Build or update a hierarchical QA coverage matrix from supplied requirements, analysis, actual product navigation, sitemap data, UI designs, and existing test cases. Use for new projects, major redesigns, large modules, unstructured coverage, page or requirement decomposition, scenario inventories, and mapping cases to Page/Screen → Block → Structure → Scenario. Do not put execution steps in the matrix or invent behavior from visuals.
---

# Build coverage matrix

Create a navigation model of functionality and map supported scenarios to existing or proposed test cases.

## Read the source of truth

Before analysis, read:

- [`../../rules/coverage-matrix-rules.md`](../../rules/coverage-matrix-rules.md)
- [`../../rules/test-case-type-rules.md`](../../rules/test-case-type-rules.md)
- [`../../rules/coverage-rules.md`](../../rules/coverage-rules.md) when classifying existing coverage
- [`../../rules/regression-model-rules.md`](../../rules/regression-model-rules.md) when the matrix will feed a regression model
- [`../../rules/reusable-setup-rules.md`](../../rules/reusable-setup-rules.md) when scenarios consume shared administration or data preparation
- [`../../rules/integration-rules.md`](../../rules/integration-rules.md) when requirements or existing cases are retrieved externally
- [`../../rules/README.md`](../../rules/README.md) for placeholder handling

## Accept input

Accept requirements, analysis, product navigation, page or screen inventories, `sitemap.xml`, UI designs, an existing matrix, test-case exports, and coverage summaries. Record source authority and scope.

Prefer requirements and analysis. For an existing product, use its actual navigation and page structure. Use designs as a structural source only when analysis is unavailable; do not infer unsupported behavior or expected results from appearance.

Use [`../collect-test-context/SKILL.md`](../collect-test-context/SKILL.md) first when the scope is anchored by an external issue, page, or TMS reference. Do not infer complete project coverage from a partial external search.

## Workflow

1. Confirm whether a full or partial matrix is needed and define the product scope.
2. Inventory pages, screens, journeys, shared elements, and integrations from authoritative inputs.
3. Reuse requirement-defined blocks; otherwise decompose by visual separation, business purpose, and functional independence.
4. List testable structure inside each block without turning every control or label into its own block.
5. Derive only scenarios supported by behavior, contract, or risk context.
6. Assign the supported type: `block`, `overview`, `e2e`, `cross`, or `integration`.
7. Link existing cases using stable identifiers. Mark a missing link as a confirmed gap only when the supplied case scope is authoritative and complete.
8. Keep shared elements and reused forms in dedicated matrix areas and reference their invocation from pages.
9. Link reusable setup and its promised output as a dependency without adding preparation steps or counting it as product coverage.
10. Report missing behavior, source conflicts, duplicate matrix entities, and the incomplete organizational rule for integration placement.
11. Return the matrix in chat or a user-requested artifact. Do not create or update external records automatically.

## Output

```text
Status: MATRIX_PROPOSAL — NOT APPLIED
Scope and sources: ...
Completeness limitations: ...
Decomposition decisions: ...

Coverage matrix
| Page or screen | Block | Structure item | Scenario | Type | Platform | Requirement or source | Linked case | Setup dependency and output | Coverage state | Notes |
| ... |

Shared elements: ...
End-to-end scenarios: ...
Cross-page logic: ...
Integration mappings requiring policy: ...
Confirmed coverage gaps: ...
Unresolved scenarios or behavior: ...
Recommended next actions: ...
```

For a large product, summarize by area and provide detailed matrix rows for the requested or changed scope unless the user requests a complete artifact.

## Optional integrations and writes

Use read tools only for sources in scope. Treat an existing matrix and external cases as read-only during analysis. Publishing a reviewed matrix or changing external records requires a separate explicit user request.
