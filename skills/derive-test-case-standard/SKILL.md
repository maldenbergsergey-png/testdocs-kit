---
name: derive-test-case-standard
description: Derive reusable, project-independent QA test-case rules and style patterns from supplied instructions, existing test documentation, curated examples, and review history. Use when a user asks to analyze a test-case corpus, capture team conventions, improve this skill pack from real documentation, or separate universal regression practices from project-specific details. Return a traceable proposal; do not silently turn examples into policy or rewrite source cases.
---

# Derive test-case standard

Extract evidence-backed conventions from QA documentation and propose focused changes to the shared standard.

## Read the source of truth

Before analysis, read:

- [`../../rules/standard-derivation-rules.md`](../../rules/standard-derivation-rules.md)
- [`../../rules/README.md`](../../rules/README.md)
- every rule file that the proposed change may affect

Do not copy detailed policy into this skill. Keep durable QA policy under `rules/`.

## Accept input

Accept instructions, approved standards, existing test cases, curated good and bad examples, review comments, and coverage documentation. Accept files or content supplied directly and optional authorized read integrations.

Require the source scope and known approval status. When either is unknown, label it explicitly rather than guessing. Ask for representative documents when the available sample cannot support generalization.

For Zephyr Scale XML exports, run [`scripts/summarize_zephyr_xml.py`](scripts/summarize_zephyr_xml.py) before qualitative analysis. Use its per-project and unique-case metrics and conflicting-duplicate report so unrelated projects and overlapping exports do not distort evidence frequency. Treat its simplicity signals as candidates for manual inspection, not automatic defects. Add `--sample-status` and `--sample-size` only when a small title-level sample is useful.

## Workflow

1. Inventory sources and record their type, project, scope, version, and approval state when known.
2. Analyze unrelated projects separately before comparing cross-project patterns.
3. Separate normative instructions from observed examples.
4. Extract candidates for structure, style, scenario boundaries, coverage value, setup reuse, update behavior, and review criteria.
5. Apply the good-example quality gate; do not equate a review status with reusable quality.
6. Remove or scope product-specific names, identifiers, data, tools, and business behavior.
7. Apply the evidence, authority, conflict, and generalization rules in `standard-derivation-rules.md`.
8. Compare candidates with the current files under `rules/`, skills, and examples.
9. Classify every candidate and produce a traceable proposal.
10. Identify which rules, skills, and examples would change after approval.
11. Do not edit repository or external documentation unless the user explicitly asks to implement the reviewed proposal.

## Output

```text
Status: PROPOSAL — NOT APPLIED
Corpus scope: ...
Source limitations: ...

Candidate rules
1. Status: CONFIRMED | CANDIDATE | PROJECT_SPECIFIC | CONFLICT | INSUFFICIENT_EVIDENCE
   Area: ...
   Candidate rule or pattern: ...
   Evidence: ...
   Scope: ...
   Rationale: ...
   Conflict or limitation: ...
   Proposed repository change: ...
   Expected effect: ...

Patterns retained as examples: ...
Patterns rejected or kept project-specific: ...
Missing evidence or decisions: ...
Implementation plan: ...
```

Keep facts, candidate interpretations, and unresolved decisions separate. Cite file names and precise locations whenever available.

## Optional integrations and writes

Use read tools only for in-scope sources. Show the derivation proposal before making changes. Apply repository edits or publish to an external system only after an explicit user request; never alter or delete source cases as part of derivation.
