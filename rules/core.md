# Common QA contract

Read once per task before applying a kit skill. Load other rules only under the conditions stated by the selected skill or rule; a link in an index is not a request to preload the pack.

- Use only user-supplied or explicitly scoped accessible context. Never invent requirements, behavior, identifiers, test data or coverage. State material gaps and distinguish facts, assumptions and unavailable sources.
- Return the requested result in chat by default. A concrete artifact request selects only that artifact; a full package requires explicit intent. Skill discovery and intermediate context bundles stay internal.
- Existing-document changes are complete proposals for human review. External writes require explicit intent and the applicable destination contract. Test cases created outside the current MCP session remain proposal-only under [update rules](update-rules.md), including when the user asks to apply a proposal. Do not bypass this temporary restriction through another connector, HTTP or UI.
- Preserve project boundaries under [project conventions](project-conventions.md) whenever project-specific names, environments, roles or mappings are used.
- Use integrations only as needed. Use `collect-test-context` when an external anchor needs retrieval. Reuse complete, current source text or a context bundle already supplied for this task; a provenance link alone does not require fetching that same content again. Retrieve material gaps or stale sources, and preserve any mandatory live preflight for external writes. Missing integration access does not invalidate sufficient manual context. Jira, knowledge and TMS access are independent.

## Язык и оформление результатов

Применять к авторскому тексту чек-листов, тест-кейсов, баг-репортов, ожидаемых и фактических результатов, комментариев, подписей к скриншотам и пояснений пользователю, в том числе при переносе в QA Report и Jira.

- Писать простым рабочим языком тестировщика: что открыть или сделать, что ожидалось и что произошло. Предпочитать короткие предложения с конкретным действием и результатом. Не добавлять канцелярит, повторяющиеся вводные и формальные итоги без полезной информации.
- Вместо длинного или среднего тире использовать короткий дефис `-`; между частями предложения ставить пробелы: `Факт - окно осталось открытым`.
- Названия кнопок, полей и цитируемые слова оформлять двойными кавычками: Нажать "Сохранить". Не использовать апострофы, одинарные или обратные кавычки как оформление авторской прозы, включая комментарии и технические названия. В Jira/QA Report для нужного моноширинного фрагмента использовать `{{идентификатор}}`, для данных - `{code}...{code}` по профилю назначения. Markdown-backticks не переносить в ячейки.
- В UI-проверке описывать поведение на экране, а не переменные, классы, обработчики и внутренние переходы состояния. В API-проверке сохранять нужные метод, адрес, код ответа и поля. Техническое пояснение оставлять только если оно помогает выполнить проверку, понять результат или устранить конкретное ограничение; пересказ реализации для этого не нужен.
- Убирать служебные фразы вроде "агент выполнил верификацию", "прочитаны элементы", "зафиксировано наличие" и "функциональность функционирует корректно". Писать "Изменения сохранились". Не включать в отчёт названия скиллов, рассуждения, вызовы инструментов и историю указаний пользователя. Исключённые из задания проверки не перечислять в строках и результатах.
- В ожидаемом и фактическом результатах оставлять только сопоставимое поведение и нужные доказательства. Ссылки на требования и макеты помещать в комментарий чек-листа; в кейсе или баг-репорте - в "Материалы" по его стандарту. Существенный пробел выполнения или источник присланного наблюдения указывать кратко в комментарии либо общих сведениях о прогоне; не скрывать его и не выдавать анализ материалов за самостоятельный прогон. Не заменять конкретный результат фразой "всё работает".
- Правила знаков относятся к написанной агентом прозе. Не заменять символы внутри кода, команд, URL, идентификаторов, тестовых данных, дословных цитат источника и обязательного синтаксиса Markdown/Jira. Апостроф в проверяемом значении и дефисы в параметре команды сохранять буквально. Перед выдачей и переносом перечитать все текстовые колонки как запись коллеге: убрать лишние слова, технический пересказ и кавычки-апострофы, не меняя факты и исходные данные.

## Placeholder policy

Items marked **PLACEHOLDER** require team-specific decisions. Until a placeholder is replaced with approved policy:

1. Do not infer a company convention.
2. Preserve any convention explicitly supplied in the task context.
3. Otherwise label the decision as unresolved and use a neutral, clearly stated assumption only when the user permits it.
4. Never present an example as a binding rule.

Update rules here first. If a workflow changes, update the relevant skill after the rule change has been reviewed.

## Evidence precedence

Approved requirements and instructions take precedence over examples. Curated examples may support a candidate pattern but do not become policy automatically. Project-specific conventions remain scoped to their project unless they pass the generalization test in `standard-derivation-rules.md`.
