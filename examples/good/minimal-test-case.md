# Good test case example

> Demonstration only; it is not a binding format standard.

**Source behavior:** Requirement `R-EXAMPLE-1` states that a signed-in user can create an item with a valid required name. Item creation is a critical business path in this fictional example.

**Title:** Save an item with a valid name

**Description:** Verify that a signed-in user can save a new item when all required data is valid.

**Tags:** `block`, `web`

**Proposed status:** `Готов к ревью`

**Priority:** `High` — the supplied fictional risk context marks item creation as a critical path.

**Path:** `/items/new`

**Preconditions:**

- The user is signed in.
- The new-item form is open.

**Test data:** Item name `Sample item`

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | Enter `Sample item` in the Name field. | The field displays `Sample item`. |
| 2 | Select **Save**. | The form closes and the item list contains `Sample item`. |

**Postcondition:** Remove `Sample item` so the case can be repeated.

Why it is useful: the scope, state, action, data, and observable outcome are explicit without relying on a specific product or implementation.
