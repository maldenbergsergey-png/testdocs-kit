# Coverage decision: CREATE

> Fictional example. The supplied coverage list is complete for item creation.

| Scenario | Decision | Reason |
| --- | --- | --- |
| Reject saving an item with an empty required name | CREATE | The new requirement adds persistent validation. The complete scoped coverage contains only valid saving; rejection needs a separate case. |
