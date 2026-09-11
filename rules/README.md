# Shared rules

This directory is the source of truth for QA test-documentation policy. Skills define procedures; these files define standards and decision criteria.

## Язык и оформление результатов

Применять к авторскому тексту чек-листов, тест-кейсов, баг-репортов, результатов тестирования, подписей к скриншотам и пояснений пользователю, в том числе при переносе в QA Report и Jira.

- Писать простым рабочим языком тестировщика: что открыть или сделать, что ожидалось и что произошло. Предпочитать короткие предложения с конкретным действием и результатом. Не добавлять канцелярит, повторяющиеся вводные и формальные итоги без полезной информации.
- Вместо длинного или среднего тире использовать короткий дефис `-`; между частями предложения ставить пробелы: `Факт - окно осталось открытым`.
- Для названий кнопок, полей и обычных цитируемых слов использовать двойные кавычки: `Нажать "Сохранить"`. Не заменять их апострофами, одинарными кавычками или обратными кавычками. Моноширинное оформление оставлять для кода и технических идентификаторов, когда оно помогает чтению.
- Убирать служебные фразы вроде "агент выполнил верификацию", "по результатам анализа предоставленного контекста", "зафиксировано наличие" и "функциональность функционирует корректно". Вместо "Зафиксировано успешное выполнение операции сохранения" писать "Изменения сохранились". Не включать в готовый отчёт названия скиллов, ход рассуждений и перечень вызовов инструментов; техническую причину ограничения оставлять, если она нужна для продолжения проверки.
- Сохранять точность и происхождение фактов: простой стиль не отменяет пометок о непроверенной части, недоступном доказательстве или проверке по материалам пользователя. Не заменять конкретный результат фразами "всё нормально" или "всё работает".
- Правила знаков относятся к написанной агентом прозе. Не заменять символы внутри кода, команд, URL, идентификаторов, тестовых данных, дословных цитат источника и обязательного синтаксиса Markdown/Jira. Апостроф в проверяемом значении и дефисы в параметре команды сохранять буквально. Перед выдачей перечитать текст как запись коллеге и убрать лишние слова, не меняя смысл.

## Rule files

- [`test-case-standard.md`](test-case-standard.md) — test-case content and writing standard.
- [`test-checklist-standard.md`](test-checklist-standard.md) — task- or document-scoped Jira checklist contract.
- [`bug-report-standard.md`](bug-report-standard.md) — bug summary/content contract, live Jira field mapping, defaults, and creation boundary.
- [`task-testing-rules.md`](task-testing-rules.md) — intent routing for checklist, full-package, cases-only, task-scoped, optimization, review, and targeted workflows.
- [`qa-task-estimation-rules.md`](qa-task-estimation-rules.md) - QA effort estimation, platform scope, base work, regression, retest, risk reserve, and package totals.
- [`qa-estimation-team-rules.md`](qa-estimation-team-rules.md) - scoped team criteria, private persistence, recalculation, and estimate-versus-actual comparisons.
- [`qa-estimation-profile.md`](qa-estimation-profile.md) - published starting process for component checks, documentation, AI validation, environments, and risk analysis.
- [`qa-estimation-platform-matrix.md`](qa-estimation-platform-matrix.md) - scoped desktop/mobile web, design breakpoints, and native iOS/Android coverage from the supplied matrices.
- [`task-execution-rules.md`](task-execution-rules.md) — advice-only task research, hands-on execution, evidence, statuses, reports, and local task history.
- [`test-case-type-rules.md`](test-case-type-rules.md) — E2E, overview, block, cross-page, integration, and platform classification.
- [`test-case-lifecycle-rules.md`](test-case-lifecycle-rules.md) — lifecycle statuses, review readiness, and task linkage.
- [`reusable-setup-rules.md`](reusable-setup-rules.md) — shared preparation procedures, administration content, dependency outputs, and cleanup.
- [`integration-rules.md`](integration-rules.md) — optional issue, knowledge, and TMS capability contract plus read/write boundaries.
- [`coverage-rules.md`](coverage-rules.md) — permanent coverage decision rules.
- [`coverage-matrix-rules.md`](coverage-matrix-rules.md) — functionality decomposition and scenario-to-case mapping.
- [`regression-model-rules.md`](regression-model-rules.md) — construction and maintenance of a traceable regression coverage model.
- [`test-run-rules.md`](test-run-rules.md) — release Test Run discovery, eligibility, depth, assignment, and creation rules.
- [`update-rules.md`](update-rules.md) — safe changes to existing cases.
- [`review-rules.md`](review-rules.md) — review criteria and finding severity.
- [`standard-derivation-rules.md`](standard-derivation-rules.md) — evidence and approval rules for deriving shared policy from a documentation corpus.
- [`project-conventions.md`](project-conventions.md) — cross-company isolation rules for runtime-only project conventions.

## Placeholder policy

Items marked **PLACEHOLDER** require team-specific decisions. Until a placeholder is replaced with approved policy:

1. Do not infer a company convention.
2. Preserve any convention explicitly supplied in the task context.
3. Otherwise label the decision as unresolved and use a neutral, clearly stated assumption only when the user permits it.
4. Never present an example as a binding rule.

Update rules here first. If a workflow changes, update the relevant skill after the rule change has been reviewed.

## Evidence precedence

Approved requirements and instructions take precedence over examples. Curated examples may support a candidate pattern but do not become policy automatically. Project-specific conventions remain scoped to their project unless they pass the generalization test in `standard-derivation-rules.md`.
