# Bad UI test case: technical overload

> Intentionally flawed, fictional demonstration. The technical behavior below is not an approved requirement.

**Title:** Edit profile

**Precondition:** The required user already exists and the content was prepared earlier.

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | Change the value and save it. | A PATCH request is sent, the internal parameter changes, the database row is updated, and everything works correctly. |

Problems illustrated:

- the tester cannot identify the product surface, starting point, user, field, or prepared content;
- the case silently depends on an earlier execution;
- the action target and test data are missing;
- the UI result is replaced with unapproved API and database implementation detail;
- “works correctly” provides no observable comparison criterion;
- unrelated technical assertions make the case harder to execute and brittle after refactoring.

Preferred direction: identify the visible field and entry path, state the required user and setup output, perform one clear save action, and describe the value visible after saving or reopening. Use a separate API or integration case only when its contract is explicitly under test.
