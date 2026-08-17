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
Request intent: generate | analyze coverage | update | review | build matrix | build regression model
Input mode: ISSUE_ANCHORED | MANUAL_CONTEXT
Scope anchor: issue key/link or supplied-context description
Issue facts: summary, behavior, acceptance criteria, status, decisions
Relevant linked requirements and knowledge: stable ID/link, title, version when available, relevant content
Existing test coverage: stable case IDs, versions, lifecycle, links, and complete case content when needed
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

Confirm the target Jira instance, project, TMS product, existing folder path (or explicit root), and exact operation before writing. For creation, validate the complete case payload before the call and report the returned stable case key afterward. Never delete external cases automatically. A request to generate, analyze, review, or check actualization does not authorize publication.

The bundled integration exposes creation of new Zephyr/TM4J cases only. Keep updates, new versions, moves, post-creation links, comments, lifecycle changes, and deletions unavailable until the user explicitly changes this policy. Supplying issue links as part of the initial create payload is allowed only when those exact links are included in the explicit creation scope.

## Least privilege

- Prefer read-only credentials or a read-only tool allowlist for onboarding and analysis.
- Keep tokens, passwords, cookies, and private keys outside the repository, prompts, examples, and committed configuration.
- Store browser-session cookies only in a service-specific private file, restrict them to the configured origin, and never return their values through MCP tools.
- Expose the create-only tool only for explicit publication requests and keep host-side write approvals enabled when the client supports them.
- Scope project configuration to trusted projects and company-approved servers.

## Browser-session authentication

Treat `AUTH_REQUIRED` as a recoverable authentication state, not as missing capability. Ask the user to complete the exact `npm run auth -- jira|confluence` browser flow returned by the connector, then retry the original read once.

Do not repeatedly open authentication while the stored session remains valid. Do not expose, request in chat, summarize, or log browser cookies or session-file contents. A normal `403` with an authenticated JSON response means insufficient permission and must not be treated as an expired session. Reauthenticate only for `401`, an authentication redirect, an explicit authentication-denied signal, a missing session, or a user-requested forced refresh.
