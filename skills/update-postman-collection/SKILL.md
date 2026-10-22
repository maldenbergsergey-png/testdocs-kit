---
name: update-postman-collection
description: Maintain Postman requests and API contract autotests after an endpoint or parameter changes, or add a new endpoint to a suitable folder. Accept supplied YAML/OpenAPI files, repository file/branch/MR links and task-specific contract exports. Use for collection maintenance, including API-change tasks with an explicitly bound collection; advice, checklist-only and TMS-case requests retain their requested artifact.
---

# Update Postman collection

Read [the common contract](../../rules/core.md) once per task and [collection maintenance rules](../../rules/postman-collection-rules.md). Keep project bindings and task artifacts outside the portable pack under [project conventions](../../rules/project-conventions.md).

## Inputs and collection discovery

Accept a local/attached YAML or JSON contract, a repository file URL, a branch/MR/commit URL, or a task-specific export. No GitLab connection or issue key is required. A supplied file is a first-class source; do not require a repository URL as well. A file can describe a whole API or only the changed methods.

Use [collect-test-context](../collect-test-context/SKILL.md) only for external task anchors needing retrieval. For repository reads, load the [GitLab profile](../../integrations/profiles/gitlab.md) when applicable. For live collection reads/writes, load the [Postman profile](../../integrations/profiles/postman.md). Inspect actual capabilities; do not assume a tool name or cloud access to local Native Git assets.

Read the target collection through Postman MCP when available, or use a supplied collection export/local file. Resolve a previously supplied private binding before asking for identifiers. Without a baseline, analyze the supplied contract and request only the collection/export needed for an exact patch. Do not reconstruct unseen requests or validator code. Without a contract, identify the specific missing method/response definition.

## Workflow

1. Establish input provenance, target collection, affected API/service/version and maintenance intent. Select the contract revision under the shared rules; separate it from the execution environment. Record unknown file provenance honestly.
2. Read the current request tree and inherited collection/folder scripts, authentication, variables and shared validator. Locate affected requests by service/version, HTTP method and normalized path, with operationId as supporting evidence. Include every relevant scenario variant; distinguish complete discovery from a partial listing.
3. Compare the task change, chosen operation definitions and current requests. Resolve referenced schemas at the same revision and expand only affected dependencies. Inventory request parameters/body separately from response status/media schemas. A method already in the collection still requires this comparison.
4. Prepare focused edits to existing requests and their schema/tests. For a new method, reuse the best existing folder by established structure and service/tag/path; create a folder only if no suitable one exists. Use existing auth, variables, setup and test conventions. Implement the documented assertions completely for supported response shapes; expose unsupported or ambiguous parts instead of claiming complete automation.
5. Validate the collection format and changed script syntax, source-to-schema coverage, allowed fields, preserved request IDs and unrelated content. Exercise the affected validator with representative positive and negative local fixtures when it is available. Do not send live requests merely to generate tests. A requested live run additionally follows [execution permissions](../../rules/execution-access-rules.md) and [execution rules](../../rules/task-execution-rules.md).
6. Show a reviewable diff or save the requested local collection/patch in the task workspace. For external publication, apply [write rules](../../rules/external-write-rules.md) and the collection preflight, conflict and retry boundaries in the shared maintenance rules. A clear request to apply/save changes to the specified Postman collection needs no repeated confirmation after the payload is ready and permissions are satisfied.
7. Read back successful writes and compare the affected content. Report the exact affected methods/folders, contract revision, actual validation/run scope and remaining gaps. Distinguish prepared, saved, applied and executed. If the comparison produces no change, return that result without rewriting the collection.

For connection or future automation advice, use the [setup guide](../../integrations/postman-collection-sync.md). Do not install connections or create a schedule as a side effect of using this skill.
