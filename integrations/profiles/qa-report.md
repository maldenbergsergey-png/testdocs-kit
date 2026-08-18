# QA Report capability profile

Use this optional profile for the QA Report editor documented at [maldenbergsergey-png/qa-report](https://github.com/maldenbergsergey-png/qa-report).

## Import contract

Send `POST {baseUrl}/api/checklists/import` with JSON:

```json
{
  "source": "testdocs-kit",
  "format": "jira",
  "title": "Readable checklist title",
  "issueKey": "https://jira.company.example/browse/TASK-123",
  "content": "h2. ..."
}
```

`format` and non-empty `content` are required. Despite its name, `issueKey` contains the full Jira issue URL for this integration. Preserve the returned `url`; do not construct it. The current QA Report contract stores the payload temporarily and puts only an import token in that URL.

The adapter validates an HTTP(S) base URL, requires explicit user confirmation, sends content in the POST body, and returns the editor URL. It does not store Jira or QA Report credentials.

## Opening behavior

Open the returned URL only after an explicit user request, in a separate external browser tab/window. Do not embed QA Report into the AI client or another page. When browser control is unavailable, show a clickable link for the user.
