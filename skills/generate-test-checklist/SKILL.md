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
3. Derive one observable check per distinct task scenario without inventing missing behavior.
4. Group checks by the natural meaning and type of the affected behavior. Choose section names from the actual content; for a small homogeneous checklist use one section. Do not force `Основные проверки` and `Дополнительные проверки`.
5. Add `Требует уточнения` only for genuine conflicts or missing expected behavior. Omit it entirely when the context is sufficient.
6. Run the completeness, decomposition, and Jira Wiki self-check from the standard.
7. Return only a short scope note, the copy-ready checklist in one fenced `text` block, and material limitations.

If context supports only part of the task, generate that safe part and put unresolved expected behavior in `Требует уточнения`. Do not emit Test Cases or internal orchestration narration.

## Optional delivery after review

Showing the checklist is the default and performs no write.

- If the user explicitly asks to publish the finalized checklist to the anchored Jira issue, use `jira_publish_checklist_comment` with the exact issue key, exact displayed Jira Wiki content, and `confirmed: true`. Do not use generic `add_comment`. Return the confirmed comment ID or URL.
- If the user explicitly asks to send or open it in QA Report, use `qa_report_import_checklist` with `format: jira` implicitly supplied by the connector, a readable title, the full Jira issue URL when known, the exact displayed content, and `confirmed: true`.
- When QA Report returns its editor URL and the user asked to open it, open it only through an available browser capability in a separate external tab/window. Never embed it. If opening is unavailable, return the clickable URL.
- Treat the two destinations independently and never retry a write silently.
