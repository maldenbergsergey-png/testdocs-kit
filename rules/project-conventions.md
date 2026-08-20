# Project-specific test-case conventions

**Status:** approved scoped convention supplied by the user. These rules apply only when the tested product context is MR and must not be generalized to unrelated projects.

## MR directions

The known product directions are:

- `MR Business` — the standard direction;
- `MR Private`;
- `MR Premium`;
- `MR Retail`;
- `MR Office`;
- `MR Загород`.

Do not infer that every direction is in scope for every requirement. Use only directions supported by the supplied task, requirement, design, Confluence material, or an explicitly approved coverage model.

## Business-stream meaning

In the supplied project documentation, a business stream is analogous to a brand and is equivalent to the page context. The resolved stream can determine the applicable brand book, object filtering, and other stream-specific behavior defined by the requirements. Therefore, do not treat a stream as only a color theme or visual skin.

Use these documented stream values as aliases for the direction names used in this rule pack:

| Documented stream value | Direction name |
| --- | --- |
| `Бизнес` | `MR Business` |
| `Private` | `MR Private` |
| `Premium` | `MR Premium` |
| `Ритейл` | `MR Retail` |
| `Офисы` | `MR Office` |
| `Загород` | `MR Загород` |

## Stream resolution

The stream is derived from project attributes and the project's primary real-estate-object type. According to the decision table in the supplied document, conditions are evaluated in this order:

1. `is_private = true` → `MR Private`, regardless of object type, `is_countryside`, or `is_premium`;
2. otherwise `is_countryside = true` → `MR Загород`, regardless of object type or `is_premium`;
3. otherwise `is_premium = true` → `MR Premium`;
4. otherwise primary object type `Офисы` → `MR Office`;
5. otherwise primary object type `Коммерция` → `MR Retail`;
6. otherwise primary object type `Квартиры`, `Таунхаусы`, `Коттеджи`, `Паркинги`, or `Кладовые` → `MR Business`.

Source limitation: the prose immediately above the decision table says that object type is checked after `Private` and `Загород`, while the table also checks `is_premium` before object type. The change history says `MR Premium` was added later. Until an approved clarification is supplied, preserve the table order in test context but explicitly report this source conflict whenever Premium precedence affects an expected result.

For test-case generation:

- derive the expected stream from supplied project attributes; do not infer it from the page appearance alone;
- cover the priority rule with distinct cases only when the requirement places stream resolution itself in scope;
- for a block whose common logic is already covered, put only stream-dependent brand-book, filtering, content, object-type, or other supported differences in the stream variant case;
- use a project or entity whose documented flags and primary object type resolve to the intended stream, and link its administration creation/configuration case as the first dependency when setup is required;
- do not assert unspecified differences merely because two streams exist.

## Direction-specific variants

When a block has the same core behavior across directions but a stream changes brand-book presentation, content, object filtering, object type, color scheme, or another explicitly defined property:

1. keep one base functional case for the shared behavior;
2. create a separate direction-specific case only for the supported differences;
3. make the first step of the direction-specific case call or link the base functional case so the common logic is executed first;
4. after the called base case, describe only the direction-specific assertions;
5. do not copy the complete base sequence into every direction case;
6. do not create empty variants for directions with no supported difference.

Name the variant from broad to narrow, preserving the direction, block, and difference, for example:

```text
MR Private. [Блок]. [Отличие]
```

The short variant case is valid even when it contains only a few own steps: its scope is the delta from the linked base case, not a duplicate end-to-end script.

## Scoped source record

- `126168442_d2082a1f29f84c0cbb661d817d067f39-200826-1551-228.pdf`, «Определение бизнес-стрима», sections `2. Общее описание` and `3. Определение стрима проекта`; supplied by the user on 2026-08-20. Approval state and document version are not stated.
