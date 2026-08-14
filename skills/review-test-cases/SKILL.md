---
name: review-test-cases
description: Review one or more QA test cases against the repository's shared standards and supplied requirements, returning status, located findings, rationale, and focused recommendations. Use for audits or review requests; do not rewrite cases unless the user separately asks for revisions.
---

# Review test cases

Review the supplied cases and report evidence-based findings without changing them.

## Read the source of truth

Before review, read:

- [`../../rules/review-rules.md`](../../rules/review-rules.md)
- [`../../rules/test-case-standard.md`](../../rules/test-case-standard.md)
- [`../../rules/test-case-type-rules.md`](../../rules/test-case-type-rules.md)
- [`../../rules/test-case-lifecycle-rules.md`](../../rules/test-case-lifecycle-rules.md)
- [`../../rules/reusable-setup-rules.md`](../../rules/reusable-setup-rules.md) when a case uses shared preparation, administration content, or an execution dependency
- [`../../rules/integration-rules.md`](../../rules/integration-rules.md) when cases or requirements are retrieved externally
- [`../../rules/coverage-matrix-rules.md`](../../rules/coverage-matrix-rules.md) when a matrix or hierarchy is supplied
- [`../../rules/coverage-rules.md`](../../rules/coverage-rules.md) only when coverage is explicitly in scope
- [`../../rules/regression-model-rules.md`](../../rules/regression-model-rules.md) only when regression-model suitability or suite structure is explicitly in scope
- [`../../rules/README.md`](../../rules/README.md) for placeholder handling

## Accept input

Accept one or more complete or partial test cases plus any requirements needed to assess behavioral correctness. Input may be pasted in chat, supplied as documents, or retrieved through optional read tools.

Do not require a specific TMS, MCP service, or integration. If content needed for a reliable review is unavailable, identify the gap rather than infer it.

When an external issue, page, or case reference is supplied, use [`../collect-test-context/SKILL.md`](../collect-test-context/SKILL.md) first. Review only the case version and requirement content actually retrieved.

## Workflow

1. Confirm the review scope and identify each case.
2. Distinguish structural, behavioral-correctness, and regression-reusability review based on the supplied requirements and scope.
3. Evaluate only against approved repository rules and explicit task context.
4. Record each issue at a precise field or step location, cite the rule section, explain impact, and recommend a focused correction.
5. Apply the first-pass executability test from the perspective of a competent tester unfamiliar with the project.
6. Check traceability, scenario focus, minimum sufficient detail, repeatability, observable outcomes, diagnostic value, transient dependencies, and hidden execution order.
7. When setup is reused, verify its named output, consumer reference, validity, cleanup ownership, and separation from the tested behavior.
8. Separate confirmed problems from suggestions and from unresolved rule placeholders.
9. Assign the overall status defined in `review-rules.md` and summarize the most important findings.

## Output

```text
Overall status: PASS | PASS_WITH_COMMENTS | CHANGES_REQUESTED | INSUFFICIENT_CONTEXT
Scope: ...
Context limitations: ...

Findings
1. Location: ...
   Rule: ...
   Problem: ...
   Why it matters: ...
   Recommendation: ...

Summary: ...
```

State explicitly when no rule-backed issues are found. Do not fully rewrite a case when the user asks only for review; offer a separate update proposal if useful.

## Optional integrations

Use available read tools only to collect in-scope cases or requirements. If no suitable tool exists, ask the user to provide the material manually. Do not write, edit, publish, or delete external data during review.
