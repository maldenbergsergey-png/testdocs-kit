# Reusable setup rules

**Status:** proposed organizational standard based on the user-supplied workflow for preparing content through administration interfaces; pending human review.

A reusable setup procedure prepares deterministic data or system state for one or more test cases. It reduces duplication but must not hide the behavior that a downstream case is intended to verify.

## When to create reusable setup

Create a reusable setup procedure when:

- the same preparation is required by multiple cases;
- preparation is longer or more specialized than a concise precondition;
- content, configuration, an account state, or another entity must be created or published through an administration or support interface;
- repeating the preparation inside every case would make cases harder to read and maintain.

Keep preparation inline when it is short, unique to one case, or is itself the action being verified.

## Procedure contract

Every reusable setup procedure must define:

```text
Название
Назначение
Требуемый доступ и начальная точка
Входные данные
Шаги подготовки в таблице «№ | Шаг | Тестовые данные | Ожидаемый результат»
Выход для зависимых кейсов
Очистка
Источник или требование, когда процедура утверждает поведение
```

Name it by the state it produces, for example `Prepare data: published content item`. Do not present a helper procedure as a complete regression test unless it independently verifies supported administration behavior.

## Writing setup steps

- Use the same Russian labels and the same four-column `№ | Шаг | Тестовые данные | Ожидаемый результат` table as a test case.
- Never combine an action and its result with an arrow or in one cell.
- Identify the administration section and stable visible controls needed to find the target.
- Include only actions required to create the promised output state.
- Keep credentials and secrets outside the procedure; state the required role or access instead.
- Confirm observable intermediate states only when they help the tester continue safely.
- End with an observable confirmation that the output is ready for use.
- End at the preparation surface. Do not add the downstream user behavior to the setup merely to prove that preparation worked; the consuming case verifies visibility, opening, or use on its own surface.
- Do not require API, database, log, or other internal checks unless the setup is explicitly performed through that approved surface.

## Output contract

State exactly what the dependent case receives, for example:

- entity name or generated identifier;
- final status such as published or active;
- public path or lookup value when supplied by the product;
- actor, account state, or configuration created;
- expiration or other reuse limitation.

Use a clear unique marker for generated data when concurrent or repeated runs could otherwise select the wrong entity. Do not invent a fixed identifier that the product generates dynamically.

When the administration interface does not expose a public path or identifier, return the stable lookup data the consuming tester can use, such as the unique title. Do not open the public surface inside setup only to discover data that the dependent case can locate from the promised lookup value.

## Dependent cases

In every dependent case:

1. reference the reusable setup by stable name or TMS identifier;
2. state which setup output is consumed;
3. begin the primary steps at the point where the actual tested behavior starts;
4. keep its own expected results independent of the setup procedure;
5. declare cleanup ownership when the setup creates mutable or persistent data.

Do not make a case depend silently on an earlier case or execution order. A setup dependency must be explicit and reproducible on demand.

## Cleanup and reuse

Define cleanup when retained data can affect later runs, shared environments, or product behavior. State whether cleanup belongs to the setup procedure, the consuming case, or a separate approved cleanup procedure. Prefer data that can be uniquely identified and safely removed or reset.

If setup can be safely reused across several cases, state the validity boundary. Do not assume that data remains unchanged indefinitely.

## Coverage and regression modeling

- Record the setup as a dependency of the consuming scenarios.
- Do not count a helper procedure as functional coverage of the administration interface.
- Create a separate focused case when creation, editing, publication, permissions, or validation in the administration interface is itself a requirement under test.
- Do not create administration-interface test cases by default when the interface is used only to prepare data for a user-facing case.
- When several cases consume one setup, keep their scenario results independent so one shared dependency does not merge their coverage intent.

## Zephyr mapping

When Zephyr reusable or call steps are available, store the preparation as one named reusable step sequence and call it from the dependent case's setup section or first preparation step. Pass or record the output using the project's supported test-data mechanism.

If the Zephyr configuration cannot return dynamic output, use a documented lookup value or unique data marker and state how the consuming tester finds the prepared entity. Do not duplicate the shared sequence in every case merely because the TMS cannot pass variables automatically.
