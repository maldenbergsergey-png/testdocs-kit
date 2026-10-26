# Common QA contract

Read once per task; load only rules required by the selected skill or rule.

- Use only user-supplied or explicitly scoped accessible context. Never invent requirements, behavior, identifiers, test data or coverage. State material gaps and distinguish facts, assumptions and unavailable sources.
- Return the requested result in chat by default. A concrete artifact request selects only that artifact; a full package requires explicit intent. Skill discovery and intermediate context bundles stay internal.
- QA-document changes are reviewable proposals. QA publication requires explicit intent and the destination contract. New Zephyr cases may be created/corrected in the same chat under [write rules](external-write-rules.md); old cases remain proposal-only under [update rules](update-rules.md), even after an apply request, through any channel. Test-app actions follow [execution permissions](execution-access-rules.md#действия-в-тестовой-среде).
- Preserve project boundaries under [project conventions](project-conventions.md) whenever project-specific names, environments, roles or mappings are used.
- Retrieve anchors with `collect-test-context`; apply [knowledge discovery](knowledge-discovery-rules.md) for artifacts from scoped knowledge, including reused context. Reuse complete current text; provenance alone needs no refetch. Collect gaps/stale sources; preserve live write preflight. Missing integrations do not invalidate manual context. Jira, knowledge and TMS access are independent.
- Use OS terminals and SSH for scoped diagnostics under [terminal access](terminal-access-rules.md).
- For saved or cross-task context, follow [context reuse](context-reuse-rules.md). For explicitly enabled model delegation, follow [model roles](model-routing-rules.md).

## Качество всех QA-артефактов

Применять к чек-листам, кейсам, багам, отчётам, ревью, оценкам и моделям покрытия, включая комментарии и сопровождение. Главный критерий - другой тестировщик понимает документ и может использовать его без дополнительных объяснений.

- Оставлять ровно столько информации, сколько нужно для задачи документа. Деталь нужна, если без неё нельзя выполнить проверку, воспроизвести проблему, сравнить результат или принять решение.
- Не повторять мысль в нескольких полях или разделах. Общее условие указывать один раз; не добавлять пустые разделы, шаблонные вступления, заключения и очевидные рекомендации.
- Не увеличивать число проверок и шагов ради объёма. Объединять признаки одного результата; разделять самостоятельные сценарии, когда различаются условия, действия или исходы.
- Сохранять необходимые условия, данные, точные значения и наблюдаемый результат. Не заменять их фразами "всё работает" или "соответствует требованиям".
- Использовать подтверждённые требования и наблюдения. Не выдавать гипотезу о причине за факт. Если пробел меняет действия или ожидание, уточнить его; независимую готовую часть можно выдать сразу. Не запрашивать сведения только ради заполнения шаблона.
- Перед выдачей или публикацией проверить содержание по источникам, воспроизводимость, естественность языка, повторы и лишние детали. Генерация AI сама по себе не означает готовность. За корректность использования и публикации отвечает сотрудник, использующий результат.

## Язык и оформление результатов

Для всех QA-артефактов и сопровождающего текста читать [правила естественного языка](writing-style-rules.md) один раз за задачу. Применять при создании, редактировании и ревью без отдельного вызова навыка и напоминания пользователя. Проверять текст перед выдачей или публикацией; сохранять факты, воспроизводимость, доказательства и обязательный формат артефакта.

## Placeholder policy

Items marked **PLACEHOLDER** require team-specific decisions. Until a placeholder is replaced with approved policy:

1. Do not infer a company convention.
2. Preserve any convention explicitly supplied in the task context.
3. Otherwise label the decision as unresolved and use a neutral, clearly stated assumption only when the user permits it.
4. Never present an example as a binding rule.

Keep policy here; skills reference it.

## Evidence precedence

Approved requirements and instructions take precedence over examples. Examples do not become policy automatically. Generalize project conventions only under `standard-derivation-rules.md`.
