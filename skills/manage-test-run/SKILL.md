---
name: manage-test-run
description: Inspect or modify a saved Test Run or Test Cycle, including case membership, order, run fields, execution assignments/results, and explicit run deletion. Keep the same run key and retained execution history. Use for run management, not for executing its checks in an app, editing source test cases or preparing a new release run.
---

# Manage test run

Read [the common contract](../../rules/core.md) once per task, then [existing-run rules](../../rules/test-run-rules.md#existing-test-run-management). For Zephyr, read the [capability profile](../../integrations/profiles/zephyr-scale.md#existing-run-management). Read release selection rules in `test-run-rules.md` only when the request changes release coverage or asks to select additional cases.

For requests to execute a run's checks in the app, use [`execute-task-testing`](../execute-task-testing/SKILL.md). If execution and result recording are both requested, execute first, then use this skill for the observed results and exact case/configuration mapping.

Resolve the selected connection, exact run key/URL and requested change. An existing run does not need its release, title convention or linked QA work item rebuilt for an ordinary membership or field edit. When only a project/folder/name is known, use `zephyr_search_test_runs`, paginate and read candidates; resolve an ambiguous target before writing. For an audit, use `zephyr_get_test_run` and `zephyr_get_test_run_results` without mutations.

For an edit, read `zephyr_get_test_run_items`. Its `items[].id` is a stable run item ID; `run.items[].id` from the public API identifies an execution. Use only the former for removals and ordering. Keep the returned content hash and exact before/after diff in current task context. Do not copy results/evidence into a newly created run.

Choose only the requested operation:

- Header changes: `zephyr_update_test_run`; omitted fields stay unchanged. For a move, read `zephyr_get_test_run_folder_tree` and use a numeric ID from this project's TEST_RUN tree. Planned dates need an explicit timezone. Do not guess fields unsupported by the tool.
- Additions: read complete case content and apply the requested scope, eligibility and deduplication rules. Resolve named testers through `jira_find_assignable_users`. Call `zephyr_add_test_run_items` with unique case keys and exact user keys; it appends and verifies order and assignments.
- Removals: map the user's case keys or selection to the current stable item IDs. If a case has multiple configurations, resolve which ones the user wants removed. Explain that those items' execution history will also be removed; an explicit request to remove those items authorizes that consequence without another confirmation. Call `zephyr_remove_test_run_items`; source library cases stay intact.
- Ordering: pass every current stable item ID exactly once in final order to `zephyr_reorder_test_run_items`.
- Latest execution changes: call `zephyr_update_test_run_result` with only the requested status, exact assignee or comment. Use observed execution evidence for a result status; planning a run is not evidence of a pass. A duplicate case/configuration is ambiguous to the public result endpoint and must not be updated by guessing.
- Whole-run deletion: use `zephyr_delete_test_run` only when the user explicitly requests deletion of that exact run, including its execution history. Removing several cases does not authorize deleting the container.

Every management mutation requires explicit operation intent, `confirmed: true`, and the current snapshot's `expectedContentHash`. Draft/review requests produce the diff only. If management tools are absent, provide the prepared diff and the scoped opt-in command from the profile. Do not switch channels to bypass a denied operation.

After each operation use its returned verification status and refresh the snapshot before another change. A conflict requires reading the new state and reconciling the diff. A timeout, incompatible endpoint or incomplete verification requires reporting the same key, accepted/uncertain phase and remaining work. Do not repeat an uncertain mutation, recreate the run, or delete it as cleanup.

Return the run's clickable URL, the changes actually verified, and any partial/unavailable result. For a proposal return the exact field/membership/order diff. Keep unrelated Jira tasks and source cases outside the mutation.
