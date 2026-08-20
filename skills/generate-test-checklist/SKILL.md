---
name: generate-test-checklist
description: Generate a scope-level QA checklist in copy-ready Jira Wiki Markup from an explicitly scoped task, Confluence page, document, file, or supplied requirements. Use for requests asking what to test, a checklist, or a test plan. Do not turn every check into a permanent test case.
---

# Generate test checklist

Create only the requested scope-level checklist. Do not perform permanent coverage classification unless the caller separately requests it.

## Read the source of truth

Before generating, read:

- [`../../rules/test-checklist-standard.md`](../../rules/test-checklist-standard.md)
- [`../../rules/integration-rules.md`](../../rules/integration-rules.md) when external context is referenced
- [`../../rules/README.md`](../../rules/README.md) for placeholder handling

## Workflow

1. Accept normalized task or document context from chat, files, or `collect-test-context`.
2. Inventory requirements, criteria, fields, roles, states, errors and supported surfaces before drafting.
3. Classify relevant comments as decisions, clarifications, unresolved questions, or previous tester checklists/execution evidence. Treat previous checklists as practitioner evidence, validate their scenarios against current requirements, and preserve the comment link or ID plus author/date when available.
4. Derive observable checks without inventing missing behavior. Group small related assertions into one executable row when they share the same setup, action, screen or functional block; split independent roles, states, actions, outcomes, errors, or rerun units.
5. Group rows by the natural meaning and type of the affected behavior. Choose section names from the actual content; for a small homogeneous checklist use one section. Do not force `Основные проверки` and `Дополнительные проверки`.
6. For every row materially derived from a previous Jira-comment checklist, fill `Комментарий` with the provenance format required by the standard. Leave actual result and status empty.
7. Add `Требует уточнения` only for genuine conflicts or missing expected behavior. Omit it entirely when the context is sufficient.
8. Run the completeness, decomposition, provenance, and Jira Wiki self-check from the standard.
9. Return only a short scope note, the copy-ready checklist in one fenced `text` block, and material limitations.

If context supports only part of the task, generate that safe part and put unresolved expected behavior in `Требует уточнения`. Do not emit Test Cases or internal orchestration narration.

## Optional delivery after review

Showing the checklist is the default and performs no write.

- If the user explicitly asks to publish the finalized checklist to the anchored Jira issue, use `jira_publish_checklist_comment` with the exact issue key, exact displayed Jira Wiki content, and `confirmed: true`. Do not use generic `add_comment`. Return the confirmed comment ID or URL.
- If the user explicitly asks to send or open it in QA Report, use `qa_report_import_checklist` with `format: jira` implicitly supplied by the connector, a readable title, the full Jira issue URL when known, the exact displayed content, and `confirmed: true`.
- When QA Report returns its editor URL and the user asked to open it, open it only through an available browser capability in a separate external tab/window. Never embed it. If opening is unavailable, return the clickable URL.
- Treat the two destinations independently and never retry a write silently.
