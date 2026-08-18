# Integration rules

**Status:** proposed portable contract for optional Jira, Confluence, and test-management integrations; pending human review.

Integrations transport context and reviewed output. They must not change QA policy, case-writing rules, or approval boundaries. The same QA workflow must remain usable from chat or local files when no integration is available.

## Capability model

Identify integrations by capability rather than product name or MCP tool name:

| Capability | Purpose | Required? |
| --- | --- | --- |
| Issue read | Retrieve one supplied task, bug, story, epic, or other work item | Only for an issue-key workflow |
| Issue relations | Retrieve relevant parent, child, linked issue, attachment, and decision context | Optional |
| Knowledge read | Retrieve a supplied or issue-linked specification or Confluence page | Optional |
| TMS read | Find and read existing cases, versions, links, folders, and lifecycle metadata | Optional |
| TMS write | Create, update, link, comment on, version, or change status of reviewed cases | Optional and approval-gated |

Do not assume a capability exists because a server is named Jira, Confluence, Zephyr, or TMS. Inspect the tools exposed by the current connection. Preserve separate error states for unavailable capability, permission denied, not found, ambiguous instance, and empty result.

## Input modes

### Supplied issue key or link

Treat an explicit issue key or URL as the primary scope anchor. Retrieve the issue and only the related material needed for the requested QA decision:

- summary, description, acceptance criteria, status, and relevant structured fields;
- comments that contain decisions, corrections, or unresolved questions;
- relevant parent, child, linked requirement, bug, or dependency;
- linked knowledge pages and attachments needed to understand behavior;
- existing test cases linked to the issue or identified by a supported TMS relation.

Do not crawl the whole project, space, or test library unless the user explicitly requests broader discovery.

### No supplied issue key or link

Use the context supplied in chat, files, or other explicitly scoped sources. Do not search an arbitrary Jira project merely because an issue integration is connected. If facts needed for an executable result are missing, request them using the active skill's missing-context behavior.

## Neutral context bundle

Normalize retrieved material into this tool-independent bundle:

```text
Request intent: prepare task testing (checklist-only | full package) | generate | analyze coverage | update | review | build matrix | build regression model
Input mode: ISSUE_ANCHORED | MANUAL_CONTEXT
Scope anchor: issue key/link or supplied-context description
Issue facts: summary, behavior, acceptance criteria, status, decisions
Relevant linked requirements and knowledge: stable ID/link, title, version when available, relevant content
Relevant source links: exact URL, readable purpose, source location, retrieval status, and whether it influenced the requested QA result
Source field inventory: every explicitly defined field, control, tab, default, validation, visibility condition, role, state, and constraint; each marked retrieved, ambiguous, or unavailable
Existing test coverage: stable case IDs, versions, lifecycle, links, and complete case content when needed
Existing coverage discovery: COMPLETE | PARTIAL | UNAVAILABLE; directly linked cases; discovered relevant cases; search scope; limitations
Source conflicts: ...
Missing capabilities or permissions: ...
Missing behavioral context: ...
Source inventory: system, stable identifier, retrieval time when available
Recommended downstream skill: ...
```

Keep raw external values alongside any neutral interpretation. Do not silently translate workflow statuses, priorities, folders, labels, or custom fields.

## Source and conflict handling

- Treat retrieved content according to its supplied authority, not according to the system that stores it.
- Do not assume that a Jira description is newer than a linked specification or that the latest comment overrides approved acceptance criteria.
- Report conflicting behavior or versions and request a decision when the conflict changes coverage or expected results.
- Retrieve only fields and attachments relevant to the QA task. Avoid collecting credentials, personal data, or unrelated comments.
- Inventory URLs in the primary issue and every scoped knowledge page. Follow only links that can materially define the requested behavior, especially linked requirements, designs/mockups, API contracts, attachments, and related decision documents. Record the exact URL, visible label or retrieved title, source location, and retrieval status. Do not recursively crawl unrelated navigation or an entire knowledge space.
- A discovered link is not evidence that its target was read. Mark inaccessible targets as unavailable. Include such a link in a case only when its purpose is identifiable from authoritative source text; otherwise raise the missing context instead of inventing a label.
- When the source describes a form, entity, table, API object, or configurable screen, enumerate every explicitly defined field and its supported properties before summarizing. Do not collapse unprocessed rows into “other fields” or silently omit a field because it looks secondary.
- Do not imply that linked pages or cases were checked when a tool, permission, or relation was unavailable.

## TMS compatibility

Map any supported test-management product to the neutral test-case fields:

```text
Стабильный идентификатор и версия кейса
Название
Цель
Предусловия
Путь
Шаг, тестовые данные и ожидаемый результат в отдельных полях каждой строки
Постусловия
Теги типа и платформы
Статус
Приоритет
Папка или иерархия
Связи с требованиями и задачами
Комментарии и причина изменения при актуализации
Переиспользуемая подготовка или вызываемые общие шаги
```

Do not assume that test cases are Jira issues. Some products store them as separate test objects; others represent them through Jira issue types or vendor-specific entities. Use the capabilities exposed by the connected MCP server and preserve unsupported fields as explicit gaps.

Do not assume modern Zephyr Scale endpoints, cloud field names, versioning, or call-step behavior for a legacy Test Management for Jira installation. Confirm the deployment, product version, and actual MCP tool schema first.

## Read and write boundary

Read-only retrieval is allowed when the user places the source in scope. Every workflow shows its result in chat by default. A user request that explicitly says to create or publish new cases may authorize creation in the same turn after the payload and exact target pass validation; no second confirmation is required. A request only to draft, generate, show, analyze, review, or check does not authorize a write.

Treat these as separate write operations. New-case creation requires either an explicit same-request create/publication instruction or a later confirmation of a reviewed draft. All other operations require a separate explicit request after review:

- create a test case;
- create a new version;
- modify fields or steps;
- link a case to an issue or requirement;
- add a comment;
- change lifecycle status;
- move a case or change folder membership.

Confirm the target Jira instance, project, TMS product, existing folder path (or explicit root), and exact operation before writing. For creation, validate the complete case payload before the call and report the returned stable case key and full case URL afterward. After any successful case creation or permitted current-session correction, return a clickable full URL supplied by the connector. If the connector cannot supply one, report that gap and do not invent a route. Never delete external cases automatically. A request to generate, analyze, review, or check actualization does not authorize publication.

The bundled integration exposes new-case creation, narrow correction of a case created by the running process, and guarded update of a previously existing case. Every update requires an explicit user instruction. Existing-case update additionally requires a content fingerprint captured from the complete baseline read; the adapter re-reads the case immediately before PUT and rejects a stale proposal when the fingerprint differs.

For every update, omitted fields remain unchanged. When changing steps, send the complete final ordered step list: the Server/DC API replaces the script, so a partial list can delete steps. Existing-case update is limited to supported content fields and cannot move, version, comment, link, transition, retire, or delete a case. On a fingerprint conflict, perform no write and require a refreshed proposal. Supplying issue links as part of initial creation remains allowed only when those exact links are in scope.

## Least privilege

- Prefer read-only credentials or a read-only tool allowlist for onboarding and analysis.
- Keep tokens, passwords, cookies, and private keys outside the repository, prompts, examples, and committed configuration.
- Store browser-session cookies only in a service-specific private file, restrict them to the configured origin, and never return their values through MCP tools.
- Expose creation and updates only for explicit user requests, enforce session provenance or baseline fingerprints inside the MCP server, and keep host-side write approvals enabled when the client supports them.
- Scope project configuration to trusted projects and company-approved servers.

## Browser-session authentication

Treat `AUTH_REQUIRED` as a recoverable authentication state, not as missing capability. Ask the user to complete the exact `npm run auth -- jira|confluence` browser flow returned by the connector, then retry the original read once.

Do not repeatedly open authentication while the stored session remains valid. Do not expose, request in chat, summarize, or log browser cookies or session-file contents. A normal `403` with an authenticated JSON response means insufficient permission and must not be treated as an expired session. Reauthenticate only for `401`, an authentication redirect, an explicit authentication-denied signal, a missing session, or a user-requested forced refresh.

## Tool-call discipline and recovered errors

- When a stable test-case key is known, call the direct case-read capability once; do not search the library first.
- Use project-wide search only for genuine discovery. Do not call `get all` merely to locate one known key, do not scrape structured MCP output with shell commands, and do not repeat an identical failing call with equivalent parameters.
- Prefer an adapter that performs product-version fallback inside one capability call. A failed internal endpoint that is recovered by a compatible endpoint is not a user-facing failure.
- Do not include raw intermediate endpoint errors or successful tool-call narration in the final response. Report a concise error only when the requested read or write still failed after the supported fallback.
- Never hide a final write failure or claim that a case was created or corrected unless the connector returned success.
