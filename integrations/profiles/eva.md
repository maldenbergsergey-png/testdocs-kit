# EvaProject and EvaWiki profile

Eva is configured as one logical connection when EvaProject and EvaWiki belong to the same Eva instance. Store one instance base URL and one API token outside the repository. Do not ask for a second documentation URL unless the organization's approved adapter explicitly requires it.

## Required profile

```text
Connection ID: local neutral identifier
Eva instance base URL: https://eva.example.invalid
Authentication: API token
Adapter: bundled Testdocs Kit read-only MCP
Allowed capabilities: explicit read-only allowlist
```

The bundled adapter expects `EVA_API_URL` and `EVA_API_TOKEN` internally. The installer supplies both from the private Testdocs Kit configuration; client configuration contains only the Testdocs Kit launcher command. Testers do not install a separate Eva binary or Go runtime.

## Capability mapping

| Neutral need | Eva source |
| --- | --- |
| Task and project context | EvaProject tasks and projects through the bundled read-only MCP or visible UI |
| Discussion context | Task comments |
| Requirement and knowledge context | EvaWiki documents and page tree |
| Bug creation structure | Live feature-subtask or project-backlog form for the selected target and `Ошибка` type |
| Bug creation and evidence | Authorized browser form; an optional write adapter must meet the contract below |

Read capabilities must be verified separately. Sharing one instance and token does not mean every user can read every project or document.

## Safety boundary

The bundled Eva MCP implements only approved read tools. Create, update, archive, and delete tools remain absent; a configured API token does not enable writes. The skill supports Eva creation through the browser form described below. This channel uses the separately enabled browser capability and its client permissions; the explicit request to create this bug is the operation-specific opt-in. Do not enable a browser, change client permissions, or switch to HTTP/UI to bypass a rejected or disabled write capability.

Follow the [Eva defect contract](../../rules/bug-report-standard.md#eva-defect-contract): the tester selects feature subtask or project backlog. Do not infer that choice from Jira's release rules or use Jira's assignee-default fallback. A draft request remains chat-only. Missing write access still permits a useful draft.

If the company later supplies a different Eva MCP, keep the same neutral context and safety contract. Validate its actual tool names and authentication variables before enabling it; never put the token in a shared command, skill, repository file, or AI-client configuration.

## Browser creation workflow

Use an already available, enabled browser capability with access to the user-selected Eva instance. Do not transfer the MCP token into the browser or request credentials in chat. If sign-in is required, let the tester sign in through the normal UI.

1. Before opening any creation UI, establish explicit create intent and route from the conversation. If the route is missing, ask "Баг относится к фиче или его нужно положить в бэклог?". For a feature subtask, require and read the tester-selected parent and its project; for backlog, require and read the selected project without requesting a parent. Use `eva_task_get` / `eva_project_get` or the visible target as appropriate. Check the current browser user: the API token's identity does not establish the browser session's identity. If the session is a service account or a different person's session, stop before opening the creation form.
2. Inspect the live UI. For a feature bug, use the selected parent's subtask creation action. For backlog, use the selected project's backlog creation action or the header creation action and select that project. Observe the actual controls and labels instead of hard-coding selectors, URL routes or task-type IDs. Treat opening a creation form as a potential write: Eva may allocate a server-side draft at this point. Never open it merely to enrich a `DRAFT_ONLY` report.
3. Select the type named `Ошибка` and verify the selected route: exact parent for a subtask, or project/backlog destination without a feature parent for backlog. Inspect the complete resulting form, including collapsed required/custom fields and defaults. Reinspect when type or project changes. A source task's displayed fields or a task-type list alone does not establish creation requirements. Do not assume `parent_id`, `parent_task_id`, epic and a generic relationship are interchangeable. A project container field is not a feature-parent relationship; map each from the live form.
4. Identify the actual title, Description, assignee and reporter controls; distinguish `Постановщик` from unrelated author/system metadata. Use the authenticated tester for both required roles, selecting that exact user when the form permits it. An automatic reporter is acceptable only when its saved identity can be verified. Resolve missing controls, ambiguous users or unsupported ownership before final submission.
5. Fill the minimal bug payload under the shared contract. For semantic blocks without dedicated fields, use real headings or readable labelled sections in the Description editor: `Шаги воспроизведения`, `Ожидаемый результат`, `Фактический результат`, and `Материалы` when present. Use its numbered list and code-block controls where supported; otherwise use readable text that preserves line breaks. Do not paste Jira Wiki or ADF into Eva. Inspect the resulting editor content, including code and links.
6. Upload the supplied, relevant, readable files using the form's attachment control. Check the displayed limits and completion state. Insert supported image previews or named links returned by Eva, with captions. Do not claim a preview from a filename or an attachment from a local path. If attachment requires a saved task, preflight that route, submit once and upload only to that returned task. Report inaccessible files or unsupported uploads as pending; do not fabricate replacements.
7. Before final submission, verify the selected route/target, `Ошибка`, platform-prefixed title, all reproduction/result blocks and both ownership values. For backlog, verify the form's actual destination behavior instead of guessing a sprint/status or assuming the currently open project's default is correct. Set no extra optional routing fields. If the form requires another field without a usable default, show the exact gap and preserve the draft while requesting the decision. Track any server draft identifier already exposed; do not silently create another draft, delete it or present it as a finalized bug.
8. Submit once through the observed control. Read the saved task and verify all required values and attachments. For a feature bug, verify the saved parent; for backlog, verify the project/backlog placement and absence of a feature parent. Obtain the real key and URL from Eva's task page or link. If saving times out or the result is ambiguous, inspect the current page/known draft or task before any further write; report uncertainty without clicking create again. Preserve the saved task on a partial attachment failure, return successful file references and identify the remaining materials.

## Optional API adapter contract

A future dedicated write adapter must have separate opt-in (off by default), explicit operation intent and enforcement of the selected route/target, defect type and self-assignment contract. Read tools must never call methods that allocate a dummy task. Do not label a composite dummy-create/form-read operation as read-only.

Before enabling API creation, verify the exact instance/version's contracts for current identity, parent relationship, project/type choices, effective create form and field serialization, required fields, file limits, uploads and saved-task verification. Expose only the needed bug workflow, not arbitrary RPC or general update/delete methods. Keep partial draft/task/attachment identifiers on failures and never automatically repeat an uncertain write. Public client code below is research evidence; it is not a complete, version-independent API contract or a tested write capability in this pack.

## Vendor implementation references

Public EvaTeam client sources inspected on 2026-09-17:

- [Current person model](https://updater.evateam.ru/evateam/master/cur/eva_opt/eva-app/common/angular/cmf_person.ts): calls `CmfPerson.get_current_user`.
- [Task model](https://updater.evateam.ru/evateam/master/cur/eva_opt/eva-app/common/angular/cmf_task.ts) and [required-field creation helper](https://updater.evateam.ru/evateam/master/cur/eva_opt/eva-app/common/angular/shared/helpers/create-task-with-required-fields/create-task-with-required-fields.helper.ts): create a dummy task, read it through `ui_get`, inspect `ui_form_json.ui_fields` and grouped fields, then save the draft. This is why creation-form inspection cannot be assumed read-only.
- [File service](https://updater.evateam.ru/evateam/master/cur/eva_opt/eva-app/modules/files/angular/files.service.ts): creates attachment metadata, uploads multipart file content to the returned attachment URL and builds HTML references. This requires separate upload and content verification; Jira attachment syntax does not apply.

These references describe the vendor's current public client. Always observe the target instance's form and behavior; older or customized versions may differ.
