---
name: collect-test-context
description: Retrieve and normalize context from supplied external issue/page/design/API/TMS references or an explicitly scoped search. Use as a read-only helper when another QA workflow needs source retrieval, or when the user asks to collect context itself. Return evidence and gaps to the caller.
---

# Collect test context

Build a minimal, traceable context bundle and return it to the calling QA skill without coupling the workflow to one MCP server or product schema.

Read [the common contract](../../rules/core.md) once per task. Follow conditional rule links only when their condition applies.

## Read the source of truth

Before retrieval, read:

- [`../../rules/integration-rules.md`](../../rules/integration-rules.md)

Read [`../../integrations/README.md`](../../integrations/README.md) only when connection capability or adapter behavior needs explanation.

## Accept input

Accept:

- a Jira issue key or URL plus a QA intent;
- a GitLab issue, merge request, commit, pipeline, or repository URL;
- a Figma node URL, Postman object URL, or scoped log/observability reference;
- an exact release version, Jira project/connection, and Test Run intent;
- a Confluence or knowledge-page link;
- a TMS case key, URL, folder, or explicitly scoped search request;
- plain chat context or local files when no external reference is supplied.

Preserve the caller's selected intent and requested output. Do not select or load downstream skills during collection. When directly invoked without a clear result intent, return collected context and material gaps.

For a task/subtask estimate, read the full supplied task, its parent story, the linked tasks and siblings in that feature's scope, and the documents defining their behavior. Map each task's change and dependencies before allocating hours. This feature-scoped completeness is not permission to crawl an entire project; inaccessible or partial sources remain explicit gaps. Parent and sibling context does not make their entire testing effort part of the target subtask.

## Discover capabilities

Apply the common contract's reuse condition before the retrieval steps below. Collect missing or stale material; an explicit refresh request also requires a new read.

Inspect the tools available in the current host and classify them as issue/change read, issue relations, knowledge read, design read, API workspace read/write, log read, TMS read, or TMS write. Match by documented capability and input/output shape, not by a hard-coded tool name.

When setup selected QA Tools, use its `testops_find_*`, `testops_get_*`, or `testops_list_*` capabilities for scoped TMS reads. When setup selected Zephyr Scale / Test Management for Jira, use only the Zephyr-compatible capabilities from the Jira connection. Do not search an unselected second TMS.

A QA Tools UI URL matching `/project/{projectId}/test-cases/{testCaseId}` is a direct TMS scope anchor, not a generic web page. Extract both identifiers and call `testops_find_testcases` once with the exact project and case scope accepted by its live schema. Do not broaden to a library search, try WebFetch first, or ask for a manual export while `testdocs_qa_tools` read tools are available.

When more than one Jira or company connection could satisfy the same key, stop before retrieval and request the intended instance. Never choose a company environment from key shape alone.

## Workflow

1. Record the request intent, supplied references, and requested scope.
2. For a release Test Run request, resolve the exact version only in the supplied Jira project/connection, retrieve its release issues, and preserve the user-specified TMS folder, platform, launch kind, coverage depth, and tester list. Search no broader TMS scope than that folder.
3. If a Jira/GitLab issue, merge request, commit or link is supplied, retrieve that exact object as the primary anchor. Do not broaden to a project-wide or group-wide search by default.
4. If a standalone Confluence or knowledge-page URL is supplied without an issue, retrieve that page as the primary knowledge anchor. Follow only its relevant requirement, design, attachment, or decision links. Do not require a Jira issue and do not crawl the whole space.
5. Retrieve only relevant parent, child, linked issue, comment, attachment, and knowledge-page content needed to understand the requested behavior. In comments, identify decisions, corrections, unresolved questions, and recognizable previous tester checklists or execution notes.
6. Inventory every URL in the primary issue and scoped knowledge pages. Classify relevant targets such as requirements, designs/mockups, API contracts, attachments, related decisions, and supporting documents; follow them only when they can materially affect the requested QA result. Preserve the exact URL, readable purpose, source location, and retrieval status. Do not claim an inaccessible target was read and do not crawl unrelated navigation.
7. For a supplied Figma selection link, preserve the exact file/node identity and retrieve only that node and materially required supported states. For a supplied Postman workspace/collection/request, retrieve only that API scope. For logs, require an environment plus a time or correlation boundary before querying.
8. Before summarizing a structured source, inventory every explicitly named field, control, tab, default, validation, visibility condition, permission, state, and constraint in scope. Preserve the source wording and mark each item retrieved, ambiguous, or unavailable. Do not collapse unprocessed items into “other fields.”
9. When existing coverage matters, use targeted discovery in this order: directly linked cases; cases explicitly named in sources; cases associated with a relevant parent, epic, or affected function when supported; focused search by stable page, function, block, or scenario terms; a confirmed folder or TMS area. Preserve raw product fields and stable identifiers. If a case key is known, read it directly. Do not use project-wide `get all` by default. For a Test Run, the confirmed folder is a hard search boundary, but every case inside it may be inspected when semantic fallback is required.
10. If no external URL or key is supplied, use only the supplied chat, files, and explicitly scoped sources. Do not search an arbitrary external project.
11. Preserve relevant comment evidence with its link or ID, author, date, and evidence type when available. Keep a previous checklist distinct from approved requirements and permanent TMS coverage; preserve its useful scenario text, but do not promote its expected results or execution status to facts without corroboration.
12. Separate facts, source conflicts, missing permissions, missing capabilities, and missing behavioral information. Use `PARTIAL_CONTEXT` when a page, attachment, table, field list, comment checklist, or relevant linked target was truncated or only partly retrieved.
13. Normalize the evidence into the context bundle from `integration-rules.md`.
14. Return the applicable fields of the neutral bundle to the caller. Keep source facts lossless but omit irrelevant capability families and duplicate raw payloads. The caller assesses artifact-specific sufficiency and continues its own workflow.

## Failure and fallback

- `AUTH_REQUIRED`: ask the user to complete the exact browser-auth command returned by the connector, then retry the original read once. Never request or display cookies.
- `NOT_FOUND`: report the exact reference and instance checked.
- `PERMISSION_DENIED`: report the missing access without claiming absence.
- `CAPABILITY_UNAVAILABLE`: name the missing capability and request manual content or an export.
- `AMBIGUOUS_INSTANCE`: list the candidate connections without opening either one further.
- `INSUFFICIENT_CONTEXT`: list the missing behavioral facts required by the downstream skill.

Continue with the evidence that is available when it is sufficient for a narrower result. Missing Confluence or TMS access must not block a chat-only workflow that already has adequate context.

## Output and boundary

Use the neutral context bundle from [integration rules](../../rules/integration-rules.md), with `CONTEXT_READY`, `PARTIAL_CONTEXT`, or `INSUFFICIENT_CONTEXT`. In an ordinary artifact workflow this bundle stays internal; expose only material source gaps in the final requested result. A direct context-collection request can return the bundle itself.

Return to the caller after retrieval. Never invoke a downstream skill or an external write from this helper.
