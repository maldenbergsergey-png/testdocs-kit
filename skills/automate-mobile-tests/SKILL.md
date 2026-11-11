---
name: automate-mobile-tests
description: Create, update or run reusable native mobile UI autotests as Maestro YAML flows for Android and iOS, including a saved flow or suite requested locally or in CI. Accept a regression case, tested checklist scenario or clear requirement. Use for executable mobile tests. A one-time app check, a TMS case or advice alone keeps its own workflow.
---

# Automate mobile tests

Read [the common contract](../../rules/core.md) once and apply the [mobile automation rules](../../rules/mobile-automation-rules.md). Use [collect-test-context](../collect-test-context/SKILL.md) when a linked source needs retrieval.

## Create or update a test

1. Identify the expected user-visible result, starting state, platforms and the source of the expectation. Accept a confirmed checklist item or a sufficiently specified requirement before a formal case exists. Reuse the case key if supplied.
2. Inspect the target project's existing flows, configuration and shared setup. Update a matching test in place. Choose a path in the requested application or QA checkout. If the destination is unknown, prepare a portable draft in the task workspace and identify what is needed to integrate it.
3. Locate controls on each target using the [Maestro profile](../../integrations/profiles/maestro.md) for Android/iOS Simulator or [Appium profile](../../integrations/profiles/appium.md) for a physical iPhone. Existing project test IDs and supplied screen hierarchies can also establish selectors. Use the runner's command reference for unfamiliar steps. Save the flow with repeatable setup and an assertion for the business outcome.
4. Exercise the **saved candidate** on the requested prepared targets, unless the user asked for a draft only. For a changed shared subflow run the relevant calling flows. Compare Android and iOS under the [mobile execution rules](../../rules/execution-native-rules.md) when both are in scope. With one device missing, finish the available part and identify the outstanding platform.

## Run saved flows or connect CI

For a run-only request select the specified files, directory or project-defined suite at the intended revision. Keep the sources intact. Inspect setup, target and effects before execution under the [test environment permissions](../../rules/execution-access-rules.md). Use the [local and CI runner profile](../../integrations/profiles/mobile-test-runners.md) for the MCP file operation, native CLI or the [portable launcher](scripts/run_flows.py). It also covers the Appium route for a physical iPhone.

For CI integration, use the project's provider and existing build job. Bind the test checkout to the app build, run on a prepared device, retain the exit status and upload the job's report even on failure. Apply the requested Git/CI operations to the project destination.

Return the flow path or diff, its case/checklist source, and the actual outcome per build and device. Include the failed assertion or missing prerequisite and an artifact location where available. Report local verification, Git publication and CI execution independently.
