---
name: prepare-task-testing
description: Prepare a full QA documentation package when explicitly requested, or resolve an ambiguous request to prepare testing. Compose checklist, coverage analysis and case proposals for the full-package branch. Concrete requests for a checklist, cases, advice, execution, review or another artifact select their specialized skill directly; direct calls here still route them correctly.
---

# Prepare task testing

Read [the common contract](../../rules/core.md) once per task and [intent/output rules](../../rules/task-testing-rules.md). Use skill discovery descriptions first; do not preload every skill in the routing table.

## Choose the result

Match the user's requested result using the routing table. If the request names a concrete artifact, invoke its skill directly. Apply task-only or targeted scope without adding other artifacts. If "prepare testing" remains ambiguous, ask one short question about the desired result, without presenting internal skill names. A full package requires explicit intent.

Use [collect-test-context](../collect-test-context/SKILL.md) only for external retrieval or scoped discovery; use supplied text/files directly. Pass the resulting context onward and reuse it without repeating retrieval unless it is incomplete or stale.

## Full package

1. Generate the task checklist through [generate-test-checklist](../generate-test-checklist/SKILL.md).
2. Collect targeted existing coverage using [collect-test-context](../collect-test-context/SKILL.md). Record discovery as `COMPLETE`, `PARTIAL` or `UNAVAILABLE` with the actual search boundary.
3. Apply [analyze-test-coverage](../analyze-test-coverage/SKILL.md) to permanent scenarios.
4. Use [generate-test-cases](../generate-test-cases/SKILL.md) in `PERMANENT_COVERAGE` for supported `CREATE` decisions; use [update-test-cases](../update-test-cases/SKILL.md) for complete `UPDATE` proposals. Preserve `NO_CHANGE`, `RETIRE_PROPOSAL` and unresolved decisions.
5. Assemble exactly the full-package output from the intent/output rules. Do not turn partial discovery into proof of missing coverage.

Preparation itself performs no external writes. An explicit same-request publication instruction proceeds through the selected artifact's destination contract after its payload is ready; it does not authorize unrelated writes.
