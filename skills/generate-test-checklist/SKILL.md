---
name: generate-test-checklist
description: Generate a task-level QA checklist in copy-ready Jira Wiki Markup from supplied requirements or an explicitly scoped task. Use for requests asking what to test, a checklist, or a task test plan. Do not turn every check into a permanent test case.
---

# Generate test checklist

Create only the task-level checklist. Do not perform permanent coverage classification unless the caller separately requests it.

## Read the source of truth

Before generating, read:

- [`../../rules/test-checklist-standard.md`](../../rules/test-checklist-standard.md)
- [`../../rules/integration-rules.md`](../../rules/integration-rules.md) when external context is referenced
- [`../../rules/README.md`](../../rules/README.md) for placeholder handling

## Workflow

1. Accept normalized task context from chat/files or `collect-test-context`.
2. Inventory requirements, criteria, fields, roles, states, errors and supported surfaces before drafting.
3. Derive one observable check per distinct task scenario without inventing missing behavior.
4. Separate direct acceptance coverage from relevant additional checks and genuine questions.
5. Run the completeness and Jira Wiki self-check from the standard.
6. Return only a short scope note, the copy-ready checklist in one fenced `text` block, and material limitations.

If context supports only part of the task, generate that safe part and put unresolved expected behavior in `Требует уточнения`. Do not emit Test Cases or internal orchestration narration.
