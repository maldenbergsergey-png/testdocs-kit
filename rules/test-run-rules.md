# Test run rules

**Status:** proposed transcription of the supplied organizational instructions; pending human review.

A Test Run or Test Cycle is an execution plan for a specific release objective. It is not a permanent regression model, a coverage matrix, or evidence that a case passed.

## Required scope

Resolve these values from the user's request, an explicitly anchored project instruction, or live metadata:

- exact release version and the issues included in it;
- launch kind: sanity, release smoke, release regression, full regression, or hotfix/targeted verification;
- platform: `web`, `app`, or `web_mobile` when approved for the project;
- existing TMS folder or another explicit case-library boundary;
- coverage depth when applicable: minimal, recommended, or extended;
- testers eligible for automatic assignment;
- Test Run title convention, Jira project, issue type, required fields, and assignment conventions.

Do not infer a company, Jira project, release, platform, folder, title, tester identity, direction, component, label format, custom-field ID, or issue-link type. Keep project values in runtime context under `project-conventions.md`.

`Full regression` is the complete eligible set for the selected platform within the supplied folder boundary. It cannot also be minimal or recommended without changing its meaning. Resolve that conflict with the user.

## Case discovery and traceability

Build the run from the release tasks in this order:

1. Retrieve cases directly linked to each release task.
2. For a task with no eligible linked case, search all cases inside the exact user-specified TMS folder boundary.
3. Compare complete case content with the task's changed behavior. Relevant signals include the same page or screen path, block, data, transition, integration, completed business process, or a scenario that passes through the changed area.
4. Accept a semantic folder match only when the relation is explainable from source-backed behavior. Title or keyword similarity alone is insufficient.
5. If no case matches, record the uncovered task scenario from the task, requirements, designs, or supplied coverage matrix. Do not attach an unrelated case merely to avoid a gap, and do not invent a case.

Preserve one traceability record for every included case: stable case key and version, source task, discovery method (`DIRECT_TASK_LINK` or `SEMANTIC_FOLDER_MATCH`), and inclusion rationale. Deduplicate by stable case identifier. If different versions of one case are returned, resolve the current eligible version before creation.

A direct task link does not make an obsolete, incomplete, wrong-platform, or irrelevant case eligible. Conversely, an unlinked case needs explicit semantic evidence and must remain inside the approved folder boundary.

## Base eligibility

Include cases only when they are executable for the requested run:

- `Ревью пройдено` is the normal eligible status;
- `Готов к ревью` is allowed only as an explicit exception when review capacity is unavailable, and the exception must be reported;
- `Черновик`, `Актуализировать`, `Неактуальный`, and other unapproved lifecycle values are excluded;
- type, platform, priority, and path must be present;
- platform must match the requested run;
- the case must be relevant to the launch objective and current release scope.

Preserve unresolved raw status and priority values. Do not silently map legacy `Draft` to `Черновик` or a TMS value such as `Normal` to conceptual `Medium`.

Remove exact duplicates, behaviorally redundant executions, and cases outside the current objective. Do not change, move, relink, or retire the source cases while forming a run.

## Test types and related scenarios

- `overview` verifies page/screen availability, main blocks, basic navigation, and key actions.
- `e2e` verifies a completed user business process and recorded result.
- `block` verifies one affected block or component.
- `cross` verifies transitions and preservation of parameters or context between pages.
- `integration` verifies affected internal or external service interaction when it can be exercised in the target environment.

Related scenarios pass through the changed area, use the same path, block, or data, depend on the same transition, or affect the same integration or business process.

## Priority and coverage depth

Priority determines the minimum execution depth, while type describes the case's role:

- `High`: preserve first; include in smoke and full regression when otherwise eligible.
- `Medium`: include in full regression; select for smoke only when release risk justifies it.
- `Low`: include in full regression; omit first when time is limited unless it directly covers the changed or risky area.

Raise conceptual priority only when source evidence supports a primary business process, heavily used function, critical user path, high change risk, or conversion impact. Do not mutate the case's stored priority while forming the run.

Use these release coverage depths:

- `MINIMAL`: critical overview, key e2e, necessary integration, and cases directly covering changed areas.
- `RECOMMENDED`: minimal plus related block and cross cases for affected functionality.
- `EXTENDED`: recommended plus additional cases for adjacent and risk-heavy areas.

When time is limited, preserve High before Medium and Medium before Low. Within one priority, prefer direct changed-area coverage, key overview/e2e, then related and adjacent scenarios.

## Launch-kind selection

### Sanity

A separate run is optional unless explicitly requested. If created, include changed-function cases; related block/cross; overview when page availability matters; testable affected integration; and e2e only when the change affects a critical completed journey. Exclude broad unrelated smoke/regression coverage and e2e for a local UI change that does not affect the business process.

### Release smoke

Include eligible High cases for critical pages and journeys, overview for changed and key pages, key e2e, and integration only when the release affects it and the environment supports verification. Normally exclude Low and deep block checks outside a release risk area.

### Release regression

Include cases for changed paths/pages/screens; related block, cross, and integration; key e2e through the changed area; High and Medium; and Low only for direct change coverage or an evidenced risk area. Under time pressure preserve, in order: High in changed areas, key overview/e2e, Medium in changed and related areas, then Low with direct risk.

### Full regression

Include every eligible case of the requested platform in the supplied folder boundary, across all approved types and High/Medium/Low priorities.

### Hotfix or targeted verification

Include cases for the fixed behavior, adjacent cases on the affected path, related overview/e2e proving neighboring journeys still work, and integration when data exchange is affected.

## Assignment

Every included execution must have exactly one assignee from the tester list supplied for this run.

1. If reliable case effort estimates exist, balance total estimated effort while keeping dependent setup/consumer cases or one coherent journey together when that reduces handoffs.
2. Otherwise sort by priority (`High`, `Medium`, `Low`), source task, path, and stable case key, then assign round-robin in the user-supplied tester order.
3. Keep the distribution difference at no more than one execution when no effort estimates or grouping constraints apply.
4. Do not introduce a tester, overload one tester based on an inferred specialty, or leave an execution unassigned. Report the final counts and any unavoidable imbalance.

## Test Run and Jira work item

Use the exact project-backed Test Run title format. Do not derive it from an example in another project.

When the request explicitly includes creation of the related QA work item:

- read the exact project's live create metadata for the requested non-defect work-item type;
- use the release-specific smoke or regression summary convention supplied for the project;
- set the current release in the semantic fixed-version field;
- apply the project's QA component or routing only when supplied or available as an unambiguous allowed value;
- let Jira set the authenticated user as reporter/author and set assignee to that same user when supported;
- use that user for an unambiguous specialist field when the live schema accepts it;
- attach the created Test Run through the semantic test-coverage field or supported relation;
- preserve the project-backed defect-linking and release-label instructions in the description without inventing link types or label formats.

For sanity, hotfix, `web_mobile`, or another mode not covered by a project-backed Jira-work-item convention, request the missing convention rather than adapting a smoke/regression example silently.

## External creation boundary

A proposal request does not authorize external writes. An explicit request to create the Test Run and linked Jira work item authorizes only those named creations after the full payload and targets pass validation.

Treat Test Run creation, case attachment, task linking, execution assignment, Jira issue creation, and Test Run-to-issue linking as distinct connector operations even when one adapter combines some of them. Preflight every required value before the first mutation. Create the Test Run before the Jira work item so the returned stable run reference can populate test coverage.

If a later operation fails, do not delete or duplicate the created run or issue automatically. Return the successful object identifiers and URLs, failed operations, and the safest supported recovery. Never claim a case, task, user, version, or Test Run was linked without a successful connector response.

## Readiness

A run is ready when its objective, release scope, platform, folder boundary, and applicable coverage depth are explicit; every included case is current and has required attributes; duplicates and irrelevant cases are removed; every case has traceability and one valid assignee; uncovered tasks are visible; and the Test Run plus Jira payloads are complete for either review or creation.
