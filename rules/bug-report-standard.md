# Bug-report standard

**Status:** proposed portable standard; pending human review.

Apply the shared [output language and punctuation rules](README.md#язык-и-оформление-результатов) to the summary, reproduction steps, results, and evidence captions.

## Evidence and sufficiency

- Convert informal or dictated notes into a concise, reproducible defect without inventing behavior, data, environment, ownership, severity, labels, or components.
- Preserve uncertainty explicitly. Ask only for a missing fact that prevents identification of the target Jira project, understanding of the defect, or reproduction. Otherwise prepare the useful partial draft and mark the gap.
- Treat screenshots, logs, request IDs, videos, requests/responses, and links as evidence only when the user supplied them or they are available in the explicitly scoped context.
- When the user references a requirement, analytics, design, page, or other material, resolve and include its direct named link when the target is supplied, linked from an anchored source, or found by an explicitly requested search within a named project, space, or system. Do not search an arbitrary company system without such scope.
- If a requested source cannot be retrieved, preserve the reference as unavailable and ask for the exact link or content only when it is material to expected behavior or reproduction.

## Summary

Write the summary as an observable problem, preferably in the form:

```text
<FE|BE|Android|iOS>. [Area or object] - [incorrect behavior] при [short condition]
```

Make the summary answer `what`, `where`, and, when useful, `under what condition`. Always start with exactly one prefix followed by a period and a space: `FE. ` (frontend), `BE. ` (backend), `Android. `, or `iOS. `. Choose from source-backed affected scope, not a guessed root cause. If scope is ambiguous, ask before creation; mark the missing prefix in a draft. Do not invent a scope, use a generic `WEB` prefix, or prefix with `Bug`, issue key, priority, or environment.

## Standalone issue or subtask

- When the defect belongs to a specific unreleased feature and the target project exposes a defect-subtask type, create it under the supplied or unambiguously linked feature issue.
- Create a standalone defect when it affects released production behavior, cannot be tied to one feature, the parent is unknown, or the project has no supported defect-subtask workflow.
- Treat the exact Jira issue types, parent field, and release rule as project schema or approved convention. Never guess a parent or silently substitute another issue type.

## Content

Capture these semantic blocks when supported by the source:

1. short context or preconditions;
2. numbered reproduction steps;
3. actual result;
4. expected result;
5. environment/build;
6. reproducibility;
7. attachments, logs, and related links.

Use the shortest executable reproduction path. Keep one action per step when separation improves reproducibility. Include required initial state, test-user role without credentials, exact page URL or API endpoint, and app/build version when relevant. Do not replace a concrete target with “open the project page.”

Describe the actual result as observable symptoms. Put a suspected cause only in a separately marked hypothesis. Expected result is mandatory for a create-ready bug and must come from a requirement, analytics, design, accepted behavior, or an explicit user statement. If it cannot be established, prepare a draft but stop before Jira creation and request clarification.

Do not duplicate a semantic block in both a dedicated Jira field and `Описание`. If Jira exposes dedicated fields for steps, actual result, expected result, environment, or reproducibility, use those fields according to their live schema. Put the remaining blocks in `Описание`. When dedicated fields do not exist, use this structure in `Описание`:

```text
Контекст / предусловия:
...

Шаги воспроизведения:
1. ...

Фактический результат:
...

Ожидаемый результат:
...

Окружение:
...

Воспроизводимость:
...

Материалы:
...
```

Omit empty optional sections. Never replace a missing result with an invented generic statement.

## Environment

- Record the environment category supported by the project, such as `DEV`, `STAGE`, or `PROD`, together with the exact page URL, API host, or application environment actually used. Environment names are portable concepts; their domains are project-specific and must come from supplied context or approved configuration.
- For web frontend defects, record browser name and version. For visual or responsive defects, also record viewport or screen resolution when it affects the observation.
- For mobile defects, record platform, OS version when relevant, app version, and build number. Add device/model when behavior may be device-specific.
- For backend or integration defects, record the relevant service/API endpoint and deployed version or build when available.
- Do not infer an environment from a familiar domain learned in another project.

## Diagnostic materials

Add only materials relevant to the defect type:

- Visual mismatch: direct design link or requirement, screenshot of the actual UI with the mismatch identifiable, expected design state or screenshot when available, and relevant resolution.
- Behavioral UI defect: screenshot when sufficient; otherwise a screen recording that shows the starting state and reproduction sequence.
- Backend, logical, or server defect: sanitized request such as cURL, structured response body and status, correlation/request ID, and a direct time-bounded log or observability link for the same environment when available.
- Crash or mobile defect: crash trace or diagnostic log, platform, app version/build, and reproduction recording when useful.

Preserve code and JSON formatting. Remove or mask credentials, cookies, authorization headers, tokens, personal data, and unrelated production payloads. Never fabricate a log, screenshot, recording, request, response, or design link. When a connector cannot upload a supplied file, include its accessible direct link if available and list the attachment as a manual follow-up after issue creation.

## Supplied attachments and previews

- Include files supplied as evidence for this bug in the create workflow unless the user excludes them. Inventory each file’s available path/content, safe upload name, type, and intended caption. Do not attach unrelated files or treat an inaccessible chat image as an available local file.
- Preflight upload support, file readability, attachment limits, and Description rendering before creating. Upload the actual supplied files to the returned issue key; a local path or external image URL alone is not a Jira attachment.
- Add uploaded images to `Материалы` in Description as small previews with readable captions. For Server/DC Wiki rendering use `!uploaded-name.png|thumbnail!` with the actual uploaded filename; logs and videos use named attachment links. Preserve the rest of Description and dedicated fields.
- For Cloud use supported ADF media with a real Media Services ID supplied by a capable connector; a Jira attachment ID is not that ID. If the connector cannot insert media, keep named links to successfully uploaded files and explicitly report that inline previews remain unavailable. Never fake media IDs or claim links are thumbnails.
- If upload or preview insertion fails after creation, preserve and return the issue key and successful attachment IDs, identify the failed/pending files, and stop uncertain writes. Do not recreate the bug, delete uploaded files, or automatically repeat an upload after an ambiguous outcome.

## Jira field mapping

- Read create metadata for the exact Jira project and defect issue type before preparing the final create payload.
- Inventory all pages of the selected issue type’s create fields, including optional custom fields. A project/type list without fields or a truncated metadata response is not sufficient.
- Build a semantic mapping before creation: block → live field ID and name → schema/serialization → value, or an explicit reason for Description fallback. Check reproduction steps (`Шаги воспроизведения`, `Steps to reproduce`), actual result (`Фактический результат`, `Actual result`), and expected result (`Ожидаемый результат`, `Expected result`) individually; these names are semantic hints, not hard-coded IDs.
- Match fields by stable field ID plus displayed name and schema. Do not rely on a custom-field ID learned from another Jira or project.
- Optional dedicated fields still take precedence over Description. Send them via the connector’s custom/additional field payload, using live IDs. For Cloud textarea fields use ADF when required; do not stringify ADF or send Wiki markup as plain ADF text.
- Use Description fallback only when the complete schema has no matching writable field. An ambiguous field, unsupported serialization, permission error, or incomplete metadata is a mapping gap, not proof that the field is absent: resolve or report it before creation. Never retry a rejected custom-field payload by silently moving everything into Description.
- Before writing, verify that each known semantic block has exactly one destination and all three reproduction/result blocks have been considered. After creation, read the issue back and check the actual saved dedicated fields, Description, and attachments. Report unverified or mismatched values without claiming success for them.
- Use the defect issue type actually available in the target project. Do not silently create a Task or Story when no defect type is available.
- Satisfy every required field. If a required value cannot be derived from approved project rules, the current Jira user, or supplied context, stop before creation and request it.
- Let Jira record the authenticated user as reporter/author. Assign the new bug to that same authenticated user when the assignee field permits it; otherwise preserve the project default and report the limitation.
- Populate a specialist/system-developer field with the same current user only when that field is unambiguously identified by metadata or an approved project mapping. Do not guess among similar user fields.
- Set labels, components, priority, severity, versions, teams, directions, and other routing fields only from approved project rules, an explicit user value, or an unambiguous Jira default. Otherwise omit optional values and return the created issue link for final triage.

## Draft and write boundary

- `составь`, `подготовь`, `покажи`, `оформи черновик`, or a voice description alone authorizes only a draft in chat.
- An explicit instruction to `создай`, `заведи`, or `зарегистрируй` the bug in the named Jira project authorizes one creation in the same turn after the exact payload passes validation. No second confirmation is required.
- A create request includes uploading the evidence supplied for that bug and inserting its previews/attachment links into the newly created Description. These are separate API writes within the authorized create workflow, requiring no second confirmation. Unrelated edits, reassignment, later attachments, comments, issue links, and transitions still require an explicit request.
- Never create a duplicate automatically after an ambiguous timeout or connector error. Search by the returned key when available; otherwise report the uncertain result and require verification.
- After success, return the stable issue key and connector-supplied full URL, plus any fields intentionally left for tester triage. Never invent a URL.
