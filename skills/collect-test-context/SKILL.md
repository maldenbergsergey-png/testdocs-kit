---
name: collect-test-context
description: Collect and normalize QA context from an explicitly supplied Jira issue, standalone Confluence or knowledge page, document, local file, and existing cases in Zephyr Scale, legacy Test Management for Jira, or another TMS. Use before drafting a source-anchored bug report or generating, reviewing, updating, optimizing, or analyzing test documentation when external context is referenced. Remain read-only and return a traceable context bundle; do not create issues or publish cases.
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

Infer the intent branches from `task-testing-rules.md`: checklist-only, full package, cases-only, task-scoped cases, optimization, review, and targeted scope. Also recognize analyze coverage, update/apply, build a matrix, and build a regression model. Do not make the user choose internal skills when their intent is clear.

Also recognize bug-report draft and Jira bug-create intent from `bug-report-standard.md`. Read that rule when this branch is selected.

## Discover capabilities

Inspect the tools available in the current host and classify them as issue read, issue relations, knowledge read, TMS read, or TMS write. Match by documented capability and input/output shape, not by a hard-coded tool name.

When setup selected QA Tools, use its `testops_find_*`, `testops_get_*`, or `testops_list_*` capabilities for scoped TMS reads. When setup selected Zephyr Scale / Test Management for Jira, use only the Zephyr-compatible capabilities from the Jira connection. Do not search an unselected second TMS.

A QA Tools UI URL matching `/project/{projectId}/test-cases/{testCaseId}` is a direct TMS scope anchor, not a generic web page. Extract both identifiers and call `testops_find_testcases` once with the exact project and case scope accepted by its live schema. Do not broaden to a library search, try WebFetch first, or ask for a manual export while `testdocs_qa_tools` read tools are available.

When more than one Jira or company connection could satisfy the same key, stop before retrieval and request the intended instance. Never choose a company environment from key shape alone.

## Workflow

1. Record the request intent, supplied references, and requested scope.
2. If an issue key or link is supplied, retrieve that issue as the primary anchor. Do not broaden to a project-wide search by default.
3. If a standalone Confluence or knowledge-page URL is supplied without an issue, retrieve that page as the primary knowledge anchor. Follow only its relevant requirement, design, attachment, or decision links. Do not require a Jira issue and do not crawl the whole space.
4. Retrieve only relevant parent, child, linked issue, decision comment, attachment, and knowledge-page content needed to understand the requested behavior.
5. Inventory every URL in the primary issue and scoped knowledge pages. Classify relevant targets such as requirements, designs/mockups, API contracts, attachments, related decisions, and supporting documents; follow them only when they can materially affect the requested QA result. Preserve the exact URL, readable purpose, source location, and retrieval status. Do not claim an inaccessible target was read and do not crawl unrelated navigation.
6. Before summarizing a structured source, inventory every explicitly named field, control, tab, default, validation, visibility condition, permission, state, and constraint in scope. Preserve the source wording and mark each item retrieved, ambiguous, or unavailable. Do not collapse unprocessed items into “other fields.”
7. When existing coverage matters, use targeted discovery in this order: directly linked cases; cases explicitly named in sources; cases associated with a relevant parent, epic, or affected function when supported; focused search by stable page, function, block, or scenario terms; a confirmed folder or TMS area. Preserve raw product fields and stable identifiers. If a case key is known, read it directly. Do not use project-wide `get all` by default.
8. If no external URL or key is supplied, use only the supplied chat, files, and explicitly scoped sources. Do not search an arbitrary external project.
9. Separate facts, source conflicts, missing permissions, missing capabilities, and missing behavioral information. Use `PARTIAL_CONTEXT` when a page, attachment, table, field list, or relevant linked target was truncated or only partly retrieved.
10. Normalize the evidence into the context bundle from `integration-rules.md`.
11. Route sufficient context to the requested downstream skill:
   - checklist-only preparation → `prepare-task-testing` checklist branch;
   - generic/full task preparation → `prepare-task-testing` full branch;
   - cases-only or task-scoped cases → `prepare-task-testing` corresponding cases branch;
   - optimization/refactoring → `prepare-task-testing` optimization branch;
   - generation → `generate-test-cases`;
   - coverage or actualization need → `analyze-test-coverage`;
   - approved update proposal → `update-test-cases`;
   - case quality review → `review-test-cases`;
   - bug-report draft or explicit Jira bug creation → `create-bug-report`;
   - coverage structure → `build-coverage-matrix`;
   - regression organization → `build-regression-model`.
12. Return the bundle and downstream result in chat. Do not call an external write tool.

## Actualization path

For a request such as “check whether cases for ISSUE-123 need actualization”:

1. retrieve the current issue and relevant approved requirement context;
2. retrieve supplied or linked existing cases, current versions, lifecycle statuses, and the latest actualization reason or comment when available;
3. send the evidence to `analyze-test-coverage` first;
4. use `update-test-cases` only for cases classified `UPDATE` and only when the current case content is available;
5. show proposals in chat; do not create versions, save updates, comment, link, move, or change statuses in TMS.

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
Input mode: ISSUE_ANCHORED | KNOWLEDGE_ANCHORED | TMS_ANCHORED | MANUAL_CONTEXT
Scope anchor: ...

Issue facts: ...
Relevant linked requirements and knowledge: ...
Relevant source links: ...
Source field inventory: ...
Existing test coverage: ...
Existing coverage discovery:
  Status: COMPLETE | PARTIAL | UNAVAILABLE
  Directly linked cases: ...
  Discovered relevant cases: ...
  Search scope: ...
  Limitations: ...
Source conflicts: ...
Missing capabilities or permissions: ...
Missing behavioral context: ...
Source inventory: ...
Recommended downstream skill: ...

External writes performed: none
```

This bundle is internal. In an ordinary task workflow, expose only source-backed QA results and material limitations, not skill routing or raw integration narration.

## Write boundary

Keep this skill read-only. It may route an explicit bug-create request to `create-bug-report`, which must inspect live create metadata and validate the exact target and payload. It may route an explicit new-case creation request to `generate-test-cases`, which must validate the target and complete content. It may route an explicit correction/apply request to `update-test-cases`, but only that skill and the MCP registry or fingerprint guard can authorize an update. Context collection never authorizes updates, versions, moves, comments, status changes, or deletion.
