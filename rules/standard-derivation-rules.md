# Standard derivation rules

**Status:** governed process for deriving reusable QA policy from supplied documentation.

Use these rules when instructions, existing test cases, review comments, or other QA documentation are supplied as evidence for improving the shared standard. The result is always a proposal for human review; source material does not silently become policy.

## Source authority

Classify every source before deriving rules:

1. **Approved instruction or policy** — normative within its stated scope.
2. **Approved test case or curated good example** — evidence of a useful pattern, not automatically a universal rule.
3. **Review history or correction** — evidence of an accepted preference when the reason and scope are known.
4. **Unreviewed case or incidental project artifact** — descriptive evidence only.
5. **Bad example** — evidence of an anti-pattern only when the defect and rationale are explicit.

When sources conflict, do not resolve the conflict by counting examples or choosing the newest file unless an approved instruction defines that precedence. Record the conflict and request a decision.

## Generalization test

Promote a pattern into a project-independent rule only when all of the following are supported:

- it improves repeatability, observability, coverage value, diagnosis, or maintenance;
- it does not depend on a particular product name, interface label, identifier format, tool, environment, or test-management schema;
- its evidence and intended scope can be cited;
- it does not contradict a higher-authority instruction;
- it can be expressed as a testable writing or coverage criterion.

Keep project-specific terminology, field mappings, workflow states, data values, and business behavior outside the shared rule. Preserve them as examples or scoped conventions instead.

## Evidence strength

- An explicit approved instruction may support a confirmed rule within its scope.
- A repeated pattern across independent, curated examples may support a candidate rule.
- Agreement across unrelated projects strengthens evidence that a writing pattern is portable; disagreement is a reason to scope or review it, not to average the projects together.
- A single example may illustrate a rule but is insufficient by itself to establish a universal convention.
- Frequency in a legacy corpus is not proof of quality.
- Missing examples are not proof that a scenario or format is prohibited.

## Good-example selection

Do not classify a case as a good reusable example from its workflow status alone. Review the case itself against the current shared rules. Prefer examples with traceable intent, reproducible setup and data, focused actions, textual observable results, and no hidden order or transient project dependency.

Reject or repair before anonymization when a candidate relies on screenshots as the only expected result, contains empty required content, exposes sensitive data, bundles unrelated scenarios, or preserves a known inconsistency. Keep the original source unchanged and record why it was not selected.

## Derivation workflow

1. Inventory the supplied sources, versions, approval state, and scope.
2. Partition independent projects or products before calculating frequencies so a larger export does not dominate cross-project conclusions.
3. Separate behavioral requirements, writing style, document schema, coverage policy, and project-specific details.
4. Identify repeated strengths and recurring defects, then select good-example candidates using the quality gate above without copying sensitive or production data.
5. Compare each candidate across projects and with the existing files under `rules/`.
6. Classify each candidate as `CONFIRMED`, `CANDIDATE`, `PROJECT_SPECIFIC`, `CONFLICT`, or `INSUFFICIENT_EVIDENCE`.
7. Propose a focused addition, modification, or removal and cite the supporting sources.
8. Show the proposal and its expected effect on skills and examples.
9. Apply repository changes only after the user asks for the proposal to be implemented. Treat external publication as a separate, explicitly approved action.

## Proposal record

```text
Status: CONFIRMED | CANDIDATE | PROJECT_SPECIFIC | CONFLICT | INSUFFICIENT_EVIDENCE
Area: structure | style | coverage | update | review | project convention
Candidate rule or pattern: ...
Evidence: source and location
Scope: ...
Rationale: ...
Conflict or limitation: ...
Proposed repository change: ...
Expected effect: ...
```

## Corpus handling boundaries

- Work only from material supplied by the user or retrieved from an authorized in-scope source.
- Do not infer approval state, authorship, chronology, or organizational authority.
- Redact credentials, personal data, production identifiers, and secrets from reusable examples.
- Do not preserve a product defect or legacy inconsistency merely to imitate corpus style.
- Do not rewrite source test cases unless a separate update request is made.
