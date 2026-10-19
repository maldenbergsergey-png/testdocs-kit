# Common QA contract

Read once per task; load only rules required by the selected skill or rule.

- Use only user-supplied or explicitly scoped accessible context. Never invent requirements, behavior, identifiers, test data or coverage. State material gaps and distinguish facts, assumptions and unavailable sources.
- Return the requested result in chat by default. A concrete artifact request selects only that artifact; a full package requires explicit intent. Skill discovery and intermediate context bundles stay internal.
- QA-document changes are reviewable proposals. QA publication requires explicit intent and the destination contract. New Zephyr cases may be created/corrected in the same chat under [write rules](external-write-rules.md); old cases remain proposal-only under [update rules](update-rules.md), even after an apply request, through any channel. Test-app actions follow [execution permissions](execution-access-rules.md#действия-в-тестовой-среде).
- Preserve project boundaries under [project conventions](project-conventions.md) whenever project-specific names, environments, roles or mappings are used.
- Retrieve external anchors as needed with `collect-test-context`. Reuse complete, current task source text or context bundles; a provenance link alone does not require refetching. Retrieve material gaps or stale sources, preserving mandatory live write preflight. Missing integration access does not invalidate sufficient manual context. Jira, knowledge and TMS access are independent.
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

- Писать как автор QA-документа, просто и словами интерфейса: "Нажать", "Открыть", "Изменения сохранились". Без рассказа о заказчике и исполнителе: "запрос пользователя", "по просьбе пользователя", "агент проверил". Убирать канцелярит, неизвестные сокращения, историю инструментов и служебных действий. Не выдумывать "я проверил".
- В UI описывать наблюдаемое поведение, не реализацию. Метод, адрес, код ответа, поля, логи и другие технические данные нужны только для проверки, воспроизведения или понимания результата.
- Ожидание и факт - короткая сопоставимая пара. Источники - в комментарии чек-листа или "Материалах" кейса/бага. Существенные ограничения и происхождение наблюдений указывать один раз в комментарии либо вводных; анализ материалов не выдавать за самостоятельный прогон. Исключённые проверки в отчёте не перечислять.
- Длинное и среднее тире заменять на ` - ` в авторской прозе. Названия кнопок, полей и цитируемые слова оформлять двойными кавычками: Нажать "Сохранить". Не использовать одинарные или обратные кавычки для прозы, включая комментарии и технические названия.
- В Jira/QA Report моноширинный фрагмент оформлять как `{{идентификатор}}`, данные - `{code}...{code}` по профилю назначения. Markdown-backticks не переносить в ячейки.
- Не менять символы внутри кода, команд, URL, идентификаторов, тестовых данных, дословных цитат и обязательного синтаксиса Markdown/Jira. Краткость описания не отменяет подлинность и полноту доказательств по правилам.

## Placeholder policy

Items marked **PLACEHOLDER** require team-specific decisions. Until a placeholder is replaced with approved policy:

1. Do not infer a company convention.
2. Preserve any convention explicitly supplied in the task context.
3. Otherwise label the decision as unresolved and use a neutral, clearly stated assumption only when the user permits it.
4. Never present an example as a binding rule.

Keep policy here; skills reference it.

## Evidence precedence

Approved requirements and instructions take precedence over examples. Examples do not become policy automatically. Generalize project conventions only under `standard-derivation-rules.md`.
