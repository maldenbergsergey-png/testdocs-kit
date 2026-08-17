---
name: collect-test-context
description: Collect and normalize QA context from an explicitly supplied Jira issue key or link, related Confluence or knowledge pages, and existing cases in Zephyr Scale, legacy Test Management for Jira, or another TMS. Use before generating, reviewing, updating, or analyzing test cases when external issue or test-management context is referenced. Also handle the no-key path by using only supplied chat or file context. Remain read-only and return a traceable context bundle; do not publish cases.
---

# Collect test context

Build a minimal, traceable context bundle and route it to the appropriate QA skill without coupling the workflow to one MCP server or product schema.

## Read the source of truth

Before retrieval, read:

- [`../../rules/integration-rules.md`](../../rules/integration-rules.md)
- [`../../rules/README.md`](../../rules/README.md)
- the source-of-truth rule files required by the downstream skill when evaluating sufficiency or conflicts

Read [`../../integrations/README.md`](../../integrations/README.md) only when connection capability or adapter behavior needs explanation.

## Accept input

Accept:

- a Jira issue key or URL plus a QA intent;
- a Confluence or knowledge-page link;
- a TMS case key, URL, folder, or explicitly scoped search request;
- plain chat context or local files when no external reference is supplied.

Infer the downstream intent only when the request clearly means generate, analyze coverage, update, review, build a matrix, or build a regression model. Otherwise return the context bundle and ask which QA operation is wanted.

## Discover capabilities

Inspect the tools available in the current host and classify them as issue read, issue relations, knowledge read, TMS read, or TMS write. Match by documented capability and input/output shape, not by a hard-coded tool name.

When more than one Jira or company connection could satisfy the same key, stop before retrieval and request the intended instance. Never choose a company environment from key shape alone.

## Workflow

1. Record the request intent, supplied references, and requested scope.
2. If an issue key or link is supplied, retrieve that issue as the primary anchor. Do not broaden to a project-wide search by default.
3. Retrieve only relevant parent, child, linked issue, decision comment, attachment, and knowledge-page content needed to understand the requested behavior.
4. When existing coverage matters, use TMS read capabilities to retrieve linked cases and their complete current versions. Preserve raw product fields and stable identifiers.
5. If no key or link is supplied, use only the supplied chat, files, and explicitly scoped sources. Do not search an arbitrary external project.
6. Separate facts, source conflicts, missing permissions, missing capabilities, and missing behavioral information.
7. Normalize the evidence into the context bundle from `integration-rules.md`.
8. Route sufficient context to the requested downstream skill:
   - generation → `generate-test-cases`;
   - coverage or actualization need → `analyze-test-coverage`;
   - approved update proposal → `update-test-cases`;
   - case quality review → `review-test-cases`;
   - coverage structure → `build-coverage-matrix`;
   - regression organization → `build-regression-model`.
9. Return the bundle and downstream result in chat. Do not call an external write tool.

## Actualization path

For a request such as “check whether cases for ISSUE-123 need actualization”:

1. retrieve the current issue and relevant approved requirement context;
2. retrieve supplied or linked existing cases, current versions, lifecycle statuses, and the latest actualization reason or comment when available;
3. send the evidence to `analyze-test-coverage` first;
4. use `update-test-cases` only for cases classified `UPDATE` and only when the current case content is available;
5. show proposals in chat; leave version creation, saving, commenting, linking, and status changes for a later explicit publication request.

## Failure and fallback

- `AUTH_REQUIRED`: ask the user to complete the exact browser-auth command returned by the connector, then retry the original read once. Never request or display cookies.
- `NOT_FOUND`: report the exact reference and instance checked.
- `PERMISSION_DENIED`: report the missing access without claiming absence.
- `CAPABILITY_UNAVAILABLE`: name the missing capability and request manual content or an export.
- `AMBIGUOUS_INSTANCE`: list the candidate connections without opening either one further.
- `INSUFFICIENT_CONTEXT`: list the missing behavioral facts required by the downstream skill.

Continue with the evidence that is available when it is sufficient for a narrower result. Missing Confluence or TMS access must not block a chat-only workflow that already has adequate context.

## Output

```text
Status: CONTEXT_READY | PARTIAL_CONTEXT | INSUFFICIENT_CONTEXT
Request intent: ...
Input mode: ISSUE_ANCHORED | MANUAL_CONTEXT
Scope anchor: ...

Issue facts: ...
Relevant linked requirements and knowledge: ...
Existing test coverage: ...
Source conflicts: ...
Missing capabilities or permissions: ...
Missing behavioral context: ...
Source inventory: ...
Recommended downstream skill: ...

External writes performed: none
```

## Write boundary

Keep this skill read-only. A later publication request must identify the reviewed content, target instance, project, TMS product, and intended create/update/link/comment/status operations before any write tool is used.
