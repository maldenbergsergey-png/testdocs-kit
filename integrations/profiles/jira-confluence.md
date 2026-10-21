# Jira and Confluence capability profile

Use this profile for any MCP server that exposes Jira issues and optional Confluence or knowledge-base content. Tool names are server-specific.

## Minimum useful capabilities

### Jira bug creation

For an explicitly requested bug creation, require two separate capabilities:

- create-metadata read for the exact project, including the authenticated current user, available issue types, field IDs/names/schemas, required flags, defaults, allowed values, and operations;
- guarded creation of one defect issue from a validated payload after explicit user intent.

Do not reuse custom-field IDs between Jira instances or projects. Return the created stable key and full issue URL. Preflight supplied evidence upload and preview capabilities as part of bug creation under `rules/bug-report-standard.md`. Preserve the created key on partial failure. Unrelated comments, issue links, transitions, and later edits remain separate operations.

When a defect may be a subtask, metadata must expose the available subtask issue type and parent field. Do not create a subtask without an exact source-backed parent key. If only standalone creation is supported, report that limitation instead of changing the intended relationship silently.

Apply the [semantic field contract](../../rules/bug-report-standard.md#jira-field-mapping) using the exact issue type's complete create metadata. In the bundled connector, put both standard `environment` and custom semantic fields in `additionalFields` under their live IDs; `description` carries only the remaining content. The connector passes `additionalFields` values through unchanged: supply Server/DC strings, or Cloud ADF objects for `environment` and textarea fields when required by their schema. Do not stringify ADF. Select, multi-select and other typed fields require their actual allowed-value shapes; a displayed name alone does not make a field free text. Read the created issue's `fields` by the same IDs to verify values; do not verify only Description.

For the bundled `jira_create_bug`, Server/DC evidence requires a confirmed Wiki renderer and explicit `descriptionFormat: "wiki"`. The adapter uploads `attachments` and then inserts `!filename|thumbnail!` for images or `[^filename]` for other files using the returned names. Missing/plain format fails before creation; attachment URLs are not a preview fallback. Cloud non-image files use named ADF links; Cloud images fail preflight because this adapter cannot obtain Media Services IDs or insert media. Use a capable media connector or return the draft under the [attachment contract](../../rules/bug-report-standard.md#supplied-attachments-and-previews).

### Jira issue read

Given an explicit issue key or URL, retrieve when available:

- stable key and URL;
- summary and description;
- acceptance criteria and relevant structured fields;
- status and issue type;
- relevant comments and decision history;
- parent, child, linked requirements, dependencies, and defects;
- attachment metadata and relevant readable content;
- links to specifications or knowledge pages.

Do not require every field. Preserve missing fields as gaps and do not infer their contents.

### Confluence or knowledge read

Given an explicit or issue-linked page, retrieve when available:

- stable page ID and URL;
- title, space, and version;
- relevant page content;
- attachment metadata and relevant readable content;
- hierarchy metadata, including children and ancestry where supported;
- focused page search within the confirmed knowledge area and continuation metadata for paginated results.

Discover relevant base/change pages under [knowledge discovery](../../rules/knowledge-discovery-rules.md), even without body links. Missing hierarchy or search is a distinct capability gap. Do not crawl an entire space by default.

The bundled Confluence adapter exposes `get_page` (including ancestry), `get_page_children` and CQL `search`. Read candidates with `get_page`; listings/excerpts are not full source text. For focused discovery use a confirmed space plus `type = "page"` and `title ~ "feature terms"` or the exact task key; `ancestor = "pageId"` limits a query to a confirmed branch. Escape source values as CQL literals instead of interpolating raw titles. Do not use `get_space_pages` to export the space.

For `search` and `get_page_children`, continue with returned `nextStart` or `nextCursor` while `hasMore` is true; keep the original query/page and scope. Unknown totals are `null`; `size` counts only the current batch. Search accepts offset or cursor continuation depending on the server. Pagination follows [Atlassian's next-link contract](https://developer.atlassian.com/server/confluence/pagination-in-the-rest-api/) and [CQL search continuation](https://developer.atlassian.com/cloud/confluence/rest/v1/api-group-content/#api-wiki-rest-api-content-search-get). A continuation that cannot advance remains partial context.

## Scope behavior

- With a supplied issue key, anchor retrieval to that issue.
- With only a Confluence link, anchor retrieval to that page and ask for the QA intent when unclear.
- With no external reference, do not search Jira or Confluence automatically; use chat and files.
- When several company instances are connected, require the intended instance before reading.

## Coverage limitation

A Jira/Confluence capability does not prove that the server can read vendor TMS data. Test cases may be separate plugin objects rather than Jira issues. Mark TMS coverage as unavailable until a known test case can be retrieved with its steps and stable identifier.
