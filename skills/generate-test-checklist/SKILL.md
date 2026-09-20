---
name: generate-test-checklist
description: Generate a scope-level QA checklist from a scoped task, Confluence page, document, file, or supplied requirements. Return copy-ready Jira Wiki Markup by default or deliver through an explicitly requested API. Use for checklist or formal test plan requests. Advice-only "what/how should I test?" uses explain-task-testing; actual verification uses execute-task-testing. Do not turn every check into a permanent test case.
---

# Generate test checklist

Create only the requested scope-level checklist. Do not perform permanent coverage classification unless the caller separately requests it.

Read [the common contract](../../rules/core.md) once per task. Follow conditional rule links only when their condition applies.

## Read the source of truth

Before generating, read:

- [`../../rules/test-checklist-standard.md`](../../rules/test-checklist-standard.md)
- [`../../rules/integration-rules.md`](../../rules/integration-rules.md) when external context or delivery is requested

## Workflow

1. Accept normalized task or document context from chat, files, or `collect-test-context`. Select the delivery mode before formatting: default chat output or explicitly requested [direct API delivery](../../rules/checklist-delivery-rules.md#direct-api-delivery). For the latter, read the destination contract, preflight the target and initialize task data with `node scripts/task-workspace.mjs init --project <project> --task <task>` from the installed kit before saving the canonical plan/payloads. It does not authorize test execution.
2. Inventory requirements, criteria, fields, roles, states, errors and supported surfaces within the requested scope before drafting.
3. Classify relevant comments as decisions, clarifications, unresolved questions, or previous tester checklists/execution evidence. Treat previous checklists as practitioner evidence, validate their scenarios against current requirements, and preserve the comment link or ID plus author/date when available.
4. Decompose the selected requirements under the standard's source-wording and one-outcome rules; merge duplicate criteria and split independently assessed outcomes.
5. Group rows by the natural meaning and type of the affected behavior. Choose section names from the actual content; for a small homogeneous checklist use one section. Do not force `Основные проверки` and `Дополнительные проверки`.
6. Place source references in `Комментарий` under the standard, including the required provenance for a previous Jira-comment checklist. Leave actual result and status empty.
7. Add `Требует уточнения` only for genuine conflicts or missing expected behavior. Omit it entirely when the context is sufficient.
8. Run the language, completeness, decomposition and provenance self-check from the standard. Validate all seven logical fields, including source comments. Apply its Jira Wiki checks and format validator when serializing to Jira; direct API delivery uses the documented destination schema.
9. By default return a short scope note, the copy-ready checklist in one fenced `text` block, and material limitations, then finish the preparation turn. Direct API delivery instead writes the validated plan under the destination rules and returns its link and any gaps without a duplicate table. Jira publication still follows [delivery rules](../../rules/checklist-delivery-rules.md).

If context supports only part of the task, generate that safe part and put unresolved expected behavior in `Требует уточнения`. Do not emit Test Cases or internal orchestration narration.

## Requested delivery

Showing the checklist is the default and performs no write. For either requested destination, read [external write rules](../../rules/external-write-rules.md) and [delivery rules](../../rules/checklist-delivery-rules.md) before writing.

- If the user explicitly asks to publish the finalized checklist to the anchored Jira issue, use `jira_publish_checklist_comment` with the exact issue key, exact displayed Jira Wiki content, and `confirmed: true`. Do not use generic `add_comment`. Return the confirmed comment ID or URL.
- If the user explicitly asks to send, fill, or open it in QA Report, read [`../../integrations/profiles/qa-report.md`](../../integrations/profiles/qa-report.md) before assessing available tools and apply [checklist delivery rules](../../rules/checklist-delivery-rules.md). For an open-report request, follow the profile's temporary HTTP workflow and credential handling; direct API mode does not require a prior displayed copy. Otherwise use the configured `qa_report_import_checklist` connector with the finalized content and `confirmed: true`.
- When QA Report returns its editor URL and the user asked to open it, open it only through an available browser capability in a separate external tab/window. Never embed it. If opening is unavailable, return the clickable URL.
- Treat the two destinations independently. For temporary API retries, follow the profile's batch receipt and idempotency contract; never duplicate an uncertain write.
