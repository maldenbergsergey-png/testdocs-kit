# Reusable regression test case example

> Demonstration only; fictional behavior is included to show the output shape and is not a binding product rule.

**Source behavior:** Requirement `R-EXAMPLE-17` states that an item name is required. Saving an item with an empty name displays validation and does not create the item. Required-name validation protects a critical creation path in this fictional example.

**Title:** Reject saving an item with an empty required name

**Description:** Verify that a signed-in user cannot create an item without the required name.

**Tags:** `block`, `web`

**Proposed status:** `Готов к ревью`

**Priority:** `High` — failure would allow invalid data on the supplied critical path.

**Path:** `/items/new`

**Preconditions:**

- The user is signed in.
- The new-item form is open.
- The item list does not contain an unnamed item created by this test.

**Test data:** Name containing no characters

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | Leave the Name field empty. | The Name field remains empty. |
| 2 | Select **Save**. | Required-field validation is displayed for Name, the form remains open, and no item is added to the item list. |

**Regression notes:** The case verifies one stable validation contract, has no dependency on another case, uses no transient identifier, and produces an observable result. Exact validation text is intentionally omitted because the source behavior does not define it.

**Postcondition:** None; the scenario creates no item.
