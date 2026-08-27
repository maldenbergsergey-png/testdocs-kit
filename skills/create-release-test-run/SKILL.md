---
name: create-release-test-run
description: Build a release, smoke, regression, sanity, or hotfix test run from an exact release version and scoped Zephyr folder; find cases linked to release tasks, add evidence-backed semantic matches for tasks without links, assign executions to named testers, and optionally create the test run plus its linked QA work item. Use for test-run or test-cycle preparation and creation, not for designing permanent regression coverage or writing new test cases.
---

# Create release test run

Build the smallest evidence-backed execution set that matches the release risk and the user's requested depth.

## Read the source of truth

Before working, read:

- [`../../rules/test-run-rules.md`](../../rules/test-run-rules.md)
- [`../../rules/test-case-lifecycle-rules.md`](../../rules/test-case-lifecycle-rules.md)
- [`../../rules/test-case-type-rules.md`](../../rules/test-case-type-rules.md)
- [`../../rules/project-conventions.md`](../../rules/project-conventions.md)
- [`../../rules/integration-rules.md`](../../rules/integration-rules.md) when Jira or TMS integrations are involved
- [`../../rules/coverage-matrix-rules.md`](../../rules/coverage-matrix-rules.md) only when missing case coverage must be navigated through a supplied matrix
- [`../../rules/README.md`](../../rules/README.md) for unresolved project values

Use [`../collect-test-context/SKILL.md`](../collect-test-context/SKILL.md) for the exact release, its tasks, linked requirements, and scoped TMS discovery. Keep retrieval read-only until the complete run and Jira-work-item payloads pass preflight.

## Resolve the request

Record the exact:

- release version and Jira/TMS instance;
- launch kind: `SANITY`, `RELEASE_SMOKE`, `RELEASE_REGRESSION`, `FULL_REGRESSION`, or `HOTFIX`;
- coverage depth: `MINIMAL`, `RECOMMENDED`, or `EXTENDED`, when applicable;
- platform and existing Zephyr folder or other explicit library boundary;
- testers eligible for assignment;
- project-backed Test Run title convention and Jira project.

Do not guess a version, platform, folder, tester, title convention, project, or required field. Resolve missing project values from an anchored instruction or live metadata. Ask only for values that remain material after available reads. `FULL_REGRESSION` means all eligible cases in the scoped folder and platform; if the user also requests a reduced depth, surface the conflict instead of silently redefining full regression.

## Build the proposal

1. Retrieve the issues assigned to the exact release version and preserve the actual release scope. Exclude an auxiliary QA work item from the product-change inventory when evidence identifies it as such.
2. Retrieve test cases directly linked to every release issue. A task relation is strong traceability evidence, but it does not override lifecycle, platform, required-field, relevance, or duplicate filters.
3. For each task with no eligible linked case, search every case in the user-specified folder boundary. Compare the complete case content with the changed behavior, affected path, block, data, transition, integration, and business process. Do not select by title similarity alone.
4. Record each accepted semantic match with its source task and concise inclusion rationale. Keep uncertain matches out of the run and report them separately.
5. If no suitable case exists, use a supplied coverage matrix, requirements, designs, and task description only to describe the uncovered execution scenario. Do not invent a case ID or attach a nonexistent case.
6. Apply the lifecycle, required-field, platform, type, priority, launch-kind, and coverage-depth rules from `test-run-rules.md`.
7. Deduplicate by stable case identifier and flag conflicting versions. Keep one execution per case unless the user explicitly requires materially different environments or configurations.
8. Assign every included execution to one named tester using the deterministic balancing rules in `test-run-rules.md`. Validate that no execution is unassigned and no unknown tester was introduced.
9. Resolve every tester through `jira_find_assignable_users`; use only an unambiguous returned `_testdocs.userKey`. Never derive a Zephyr `userKey` from a display name or email address.
10. Prepare the exact immutable Test Run payload, task links, execution assignments, and linked Jira QA work-item payload. Read live create metadata through `jira_get_work_item_create_metadata` before preparing the Jira write.
11. Return the complete proposal and material limitations. Do not generate new permanent test cases as part of this workflow.

## Creation boundary

`Собери`, `подготовь`, `составь`, `покажи`, and `предложи` request a proposal only. `Создай`, `заведи`, `опубликуй`, or an equally explicit instruction to write to Zephyr/Jira authorizes the named creation operations after preflight; no second confirmation is required.

Before creation, verify that the connected tools separately support:

- complete release and issue reads;
- scoped complete TMS case reads and issue relations;
- Test Run/Test Cycle creation, case attachment, task linking, and execution assignment;
- Jira create metadata and creation for the exact non-defect work-item type;
- linking the created Test Run through the project's test-coverage field or relation.

For a non-root target, call `zephyr_list_test_run_folders` before creation and use only an exact returned Test Run folder path. Do not infer it from the test-case folder tree or retry guessed variants. The public API discovers paths from existing Test Runs and cannot reveal an empty folder; when that limitation applies, request the exact path. For root creation, omit `folder` completely—never send `/`.

Call `zephyr_create_test_run` once with the complete deduplicated `items` list, exact release issue links, and resolved assignee `userKey` for every item. The public Server/DC API makes the run composition immutable, so do not create an empty run or plan to attach or reassign cases later. After the run returns a stable key, call `jira_create_qa_work_item` with the exact live-metadata fields and that run key or URL in the semantic test-coverage field.

If either protected create-tool is absent, report that creation is not enabled for the Zephyr-linked Jira connection and give the narrow recovery command `npm run update -- --enable-release-test-run-writes`; do not describe the workflow itself as forbidden. This opt-in must not enable Bug creation, checklist publication, generic Jira writes, or Test Run writes for other Jira connections. On a partial failure, do not delete, recreate, or silently retry mutations; report exactly what exists, what failed, and the safe manual or supported next action.

## Output

For a proposal, return:

```text
Status: TEST_RUN_PROPOSAL — NOT CREATED
Release and scope: ...
Launch kind and coverage depth: ...
Platform and TMS folder: ...
Test Run title: ...

Release tasks: ...
Included cases:
- case key and title; source: DIRECT_TASK_LINK | SEMANTIC_FOLDER_MATCH; linked task; type; priority; path; assignee; rationale
Uncovered task scenarios: ...
Excluded or uncertain cases: case; reason
Assignment balance: tester → executions

Linked Jira QA work item:
- issue type, summary, description, release, component/routing, reporter, assignee, specialist, Test Run relation

Capabilities and limitations: ...
External writes performed: none
```

After creation, return the stable Test Run key/URL and Jira issue key/URL supplied by the connectors, attached-case and assignment counts, and any partial failures. Never invent a URL or claim that a relation or assignment exists without a successful connector response.
