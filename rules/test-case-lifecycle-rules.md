# Test case lifecycle rules

**Status:** proposed transcription of the supplied organizational instructions; pending human review.

## Active lifecycle

| Status | Meaning | Set by | Use in test runs |
| --- | --- | --- | --- |
| `Черновик` | The case is being created or edited and is not ready for use. | Author | No |
| `Готов к ревью` | The case is complete and submitted for review. | Author | Allowed when review capacity is unavailable |
| `Ревью пройдено` | The case has been reviewed and is ready for test runs. | Reviewer | Yes |
| `Актуализировать` | Product changes require the case to be updated. | Any team member | Treat as needing review before reliable reuse |
| `Неактуальный` | The behavior changed or was removed and the case is no longer used. | Any team member | No |

## Restricted statuses

Use only by team agreement or in a separately approved workflow:

- `Создан` — the case still needs to be written from scratch;
- `В работе` — writing or editing is in progress and the case is not ready for review;
- `Ревью не пройдено` — corrections and repeated review are required.

The supplied Zephyr corpus contains the raw value `Draft`, while the instruction names the default status `Черновик`. Preserve `Draft` as an unresolved legacy or system value until the team confirms whether they are equivalent.

## Task linkage

- Create and update cases within the tested task whenever possible.
- Link prepared cases to that tested task in Zephyr Scale.
- Create a separate `Подготовка тест-кейсов` task only when documentation cannot be completed in the tested task, only part of the needed set was prepared, or cases have not reached `Готов к ревью`.
- Treat documentation as prepared when all needed cases are created or updated, linked to the tested task, listed in the test report, and at least `Готов к ревью`.
- Before regression, bring every documentation-preparation task for the release to at least `Готов к ревью`.

Do not create or update an external task unless the user explicitly requests that external write.
