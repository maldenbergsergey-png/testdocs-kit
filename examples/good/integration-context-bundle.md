# Integration context bundle example

> Fictional demonstration of a partial read-only result. It does not describe a real company or issue.

```text
Status: PARTIAL_CONTEXT
Request intent: generate
Input mode: ISSUE_ANCHORED
Scope anchor: DEMO-123

Issue facts:
- Summary: Add a confirmation page after submitting the example form.
- Supported behavior: After valid submission, the confirmation page displays the submitted reference number.
- Acceptance criteria source: DEMO-123 description.

Relevant linked requirements and knowledge:
- KB-DEMO-7, “Example form flow”, version 3.

Existing test coverage:
- Not retrieved.

Source conflicts:
- None found in the retrieved scope.

Missing capabilities or permissions:
- TMS read is CAPABILITY_UNAVAILABLE; the connected server exposes Jira and knowledge reads only.

Missing behavioral context:
- Required invalid-submission behavior is not defined.

Source inventory:
- Jira issue DEMO-123.
- Knowledge page KB-DEMO-7, version 3.

Recommended downstream skill: generate-test-cases for the supported positive behavior.
Coverage relationship remains INSUFFICIENT_CONTEXT because existing cases were not checked.

External writes performed: none
```

Why it is useful: it separates retrieved facts from missing TMS access and still permits a narrower chat-only draft without claiming that coverage is absent.
