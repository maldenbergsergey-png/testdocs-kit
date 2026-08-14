# Jira and Confluence capability profile

Use this profile for any MCP server that exposes Jira issues and optional Confluence or knowledge-base content. Tool names are server-specific.

## Minimum useful capabilities

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
- child pages only when the source explicitly depends on them.

Do not crawl an entire space by default.

## Scope behavior

- With a supplied issue key, anchor retrieval to that issue.
- With only a Confluence link, anchor retrieval to that page and ask for the QA intent when unclear.
- With no external reference, do not search Jira or Confluence automatically; use chat and files.
- When several company instances are connected, require the intended instance before reading.

## Coverage limitation

A Jira/Confluence capability does not prove that the server can read vendor TMS data. Test cases may be separate plugin objects rather than Jira issues. Mark TMS coverage as unavailable until a known test case can be retrieved with its steps and stable identifier.
