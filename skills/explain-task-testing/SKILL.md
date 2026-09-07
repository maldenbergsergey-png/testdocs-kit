---
name: explain-task-testing
description: Study a supplied task, requirement, issue, design, or API context and explain in clear practical language how a tester can verify it. Use for “how should I test this?” or requests to understand a testing approach. Return guidance, not a checklist, permanent test cases, or execution results.
---

# Explain task testing

Explain how to verify the requested change without turning the answer into a formal QA artifact.

## Read the source of truth

Before work, read:

- [`../../rules/task-execution-rules.md`](../../rules/task-execution-rules.md)
- [`../../rules/integration-rules.md`](../../rules/integration-rules.md) when an external source is supplied
- [`../../rules/project-conventions.md`](../../rules/project-conventions.md) when project-specific environments, directions or roles matter

Use [`../collect-test-context/SKILL.md`](../collect-test-context/SKILL.md) when a Jira/GitLab issue, Figma node, knowledge page or another external link anchors the request.

## Workflow

1. Establish the exact change, current iteration scope and source-backed expected behavior.
2. Identify the smallest useful set of surfaces: UI, API/backend, integration, mobile, data, permissions or logs.
3. Explain preparation, action, observation and comparison for each relevant behavior in ordinary language.
4. Explain unfamiliar mechanisms briefly and connect them to what the tester will actually see.
5. Separate definite checks from questions caused by missing or conflicting requirements.
6. Mention useful diagnostic evidence and access needs without claiming the test was executed.

Do not output Jira Wiki tables, permanent Test Cases, statuses or fabricated results. If the user changes the request to actual execution, route to `execute-task-testing`. If they ask for a checklist or Test Cases, preserve that artifact-specific intent through `prepare-task-testing`.

## Output

Return a concise explanation organized by the natural test flow. Include:

- what the change does and where the risk lies;
- how to prepare the state or data;
- how to exercise the supported paths and what to observe;
- how to recognize a failure and what evidence would help;
- material unknowns or inaccessible sources.

Keep internal skill selection and integration narration out of the result.
