---
name: automate-mobile-tests
description: Set up a tester's Windows or macOS workstation for project mobile autotests, or create, update and run reusable Android/iOS Maestro YAML flows locally or in CI. Accept a regression case, checked checklist item or clear requirement. One-time app checks, TMS cases and advice-only requests keep their own workflows.
---

# Automate mobile tests

Read [the common contract](../../rules/core.md) once and apply the [mobile automation rules](../../rules/mobile-automation-rules.md). Use [collect-test-context](../collect-test-context/SKILL.md) when a linked source needs retrieval.

Use the [portable team guide](../../docs/mobile-autotests.md) when documenting authoring, project onboarding or day-to-day commands. Use the target project's published commands and settings where they differ from the examples.

## Set up a tester's workstation

For an explicit request to set up project mobile autotests locally, follow the [workstation procedure](references/workstation-setup.md). Use available local tools to do the authorized work and verify a saved smoke test on the selected targets. A setup request needs the project and device context, without requiring a Jira case.

## Create or update a test

1. Identify the expected user-visible result, starting state, platforms and the source of the expectation. Accept a confirmed checklist item or a sufficiently specified requirement before a formal case exists. Reuse the case key if supplied and map the case's material expectations to assertions.
2. Inspect the target project's existing flows, configuration and shared setup. Apply the [suite structure rules](../../rules/mobile-automation-structure-rules.md) when creating or reorganizing a suite. Update a matching test in place. Choose a path in the requested application or QA checkout. If the destination is unknown, prepare a portable draft in the task workspace and identify what is needed to integrate it.
3. Separate essential fixed data from interchangeable objects using the [test data selection rules](../../rules/mobile-automation-rules.md#выбор-тестовых-данных). Implement bounded selection and alternatives inside the flow, retain the selected object's identity for assertions, and explain any necessary fixed values.
4. Locate controls on each target using the [Maestro profile](../../integrations/profiles/maestro.md) for Android/iOS Simulator or [Appium profile](../../integrations/profiles/appium.md) for a physical iPhone. Existing project test IDs and supplied screen hierarchies can also establish selectors. Use the runner's command reference for unfamiliar steps. Save the flow with repeatable setup and an assertion for the business outcome.
   If the case crosses into a desktop browser, follow the [browser step procedure](../../integrations/profiles/mobile-test-runners.md#браузерный-шаг-в-мобильном-сценарии) for inspecting the page and saving a repeatable step.
5. Exercise the **saved candidate** on the requested prepared targets, unless the user asked for a draft only. For a changed shared subflow run the relevant calling flows. Check that data selection handles an unavailable initial candidate and an exhausted search without hiding failed assertions. Compare Android and iOS under the [mobile execution rules](../../rules/execution-native-rules.md) when both are in scope. With one device missing, finish the available part and identify the outstanding platform.

## Run saved flows or connect CI

For a run-only request select the specified files, directory or project-defined suite at the intended revision. Keep the sources intact. Inspect setup, target and effects before execution under the [test environment permissions](../../rules/execution-access-rules.md). Use the [local and CI runner profile](../../integrations/profiles/mobile-test-runners.md) for the MCP file operation, native CLI or the [portable launcher](scripts/run_flows.py). It also covers the Appium route for a physical iPhone.

For CI integration, use the project's provider and existing build job. Bind the test checkout to the app build, run on a prepared device, retain the exit status and upload the job's report even on failure. Apply the requested Git/CI operations to the project destination.

When adding team launch commands, document first-time setup and how to run one platform, both platforms, a case or a group. If the project uses Allure and asks for step detail, follow the [step-reporting profile](../../integrations/profiles/mobile-test-runners.md#пошаговый-отчёт-в-allure) and verify the rendered report from the saved flow.

Return the flow path or diff, its case/checklist source, and the actual outcome per build and device. Include the failed assertion or missing prerequisite and an artifact location where available. Report local verification, Git publication and CI execution independently.
