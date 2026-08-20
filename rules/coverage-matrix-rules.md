# Coverage matrix rules

**Status:** proposed transcription of the supplied organizational instructions; pending human review. The source section for integration placement is incomplete and remains unresolved.

The coverage matrix is the primary navigation model of functionality and test coverage. It does not replace test cases and does not contain execution steps. Test cases are created from scenarios recorded in the matrix. Reusable setup procedures are linked dependencies, not matrix scenarios, unless the preparation behavior is independently required and tested.

## When the matrix is required

Create or fully rebuild a matrix:

- at the start of a new project;
- during a complete redesign or refactoring;
- when an existing project has no test cases or no understandable scenario structure;
- when a large new module is introduced.

Stable existing projects may use the matrix partially for the affected scope.

## Sources

Use sources in this order when available:

1. approved requirements and analysis;
2. actual product navigation and page structure for an existing product;
3. `sitemap.xml`;
4. UI designs only when analysis is unavailable.

Do not infer behavioral scenarios from visual designs when expected behavior is not defined.

## Structure

Build the matrix as:

```text
Page or screen → Block → Block structure → Scenarios → Linked test cases
```

- A **block** is a visually or logically independent area with its own function.
- **Structure** lists testable elements inside the block: fields, buttons, controls, text, states, errors, and dynamic data.
- A **scenario** is a supported user or system behavior, not an execution step.

## Construction workflow

1. Identify pages or screens and their hierarchy.
2. Reuse blocks already defined in requirements.
3. When blocks are not defined, divide the page by visual zones, business purpose, and functional independence.
4. List the structure inside each block.
5. Derive supported scenarios.
6. Link existing cases for an existing project or proposed cases for a new project.

Update the matrix when pages, logic, or scenarios change.

## Decomposition

Do not create a block for every button, label, or icon. Group elements into meaningful units such as a form, product card, or recommendations area.

Treat a page made of one form as one block. Its structure may include all fields, buttons, error messages, validation, and successful outcome.

Combine small related page elements into the nearest meaningful visual or functional block. Do not create separate matrix scenarios or permanent cases merely for an isolated heading, label, icon, or other element with no independent behavior. If one block contains several substantial behaviors, divide its scenarios into logical functional parts while retaining the common parent block.

## Shared elements

Keep a separate `Shared elements` area for headers, footers, global notifications, shared modal windows, shared forms, and components reused across pages.

- Do not duplicate a shared element inside every page when its content and behavior are identical.
- Record only the varying part in a page when the shared element changes by page.
- Model a shared form once and record `Open form` scenarios at its entry points.
- For an E2E case, list every supported entry point in setup when the entry point affects the path.
- Link one base functional case to every page where an identical shared block appears; do not clone the case per page.
- When a supported product variant changes only part of the shared block, link the base case plus one delta-only variant case. The variant case calls the base case and contains only the differing assertions.

## Setup dependencies

When a scenario needs content or state prepared through an administration or support interface:

- link the reusable setup procedure in the scenario notes or dependency field;
- name the output consumed by the scenario;
- do not duplicate the setup actions in the matrix;
- do not count the helper procedure as coverage of the administration interface;
- model stable administration behavior for a user-facing configurable entity as one scenario per supported operation: creation, update, and deletion;
- split one operation into numbered stages only when its size or independent workflow stages make one case impractical;
- make the creation/configuration case or its first stage an explicit first-step dependency of the functional consumer, conditionally skipped when a conforming entity already exists;
- keep pure preparation helpers distinct when administration behavior is outside the supported scope.

## Placement by test type

- `block` cases link to a specific block and structure item.
- `overview` cases link to the whole page; the block may be empty or `Page overview`.
- `e2e` cases belong in a separate `End-to-end scenarios` area and are not tied to one block.
- `cross` cases belong in `Cross-page logic` or in `End-to-end scenarios` when they are part of a completed process.
- **Integration placement:** the supplied instruction ends mid-section. Preserve existing mappings and request the missing approved rule instead of inventing a location.

## Matrix record

```text
Page or screen: ...
Block: ...
Structure item: ...
Scenario: ...
Test type: e2e | overview | block | cross | integration
Platform: web | app | web_mobile
Requirement or source: ...
Linked case: ...
Coverage state: COVERED | PROPOSED | INSUFFICIENT_CONTEXT
Notes and constraints: ...
Reusable setup dependency and output: ...
```
