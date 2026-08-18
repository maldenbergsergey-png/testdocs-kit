# Optional integrations

Integrations are context transport, not QA logic. This repository works fully without MCP, Jira, Confluence, Zephyr, or any other external system.

## Start here

- [`codex-mcp-setup.md`](codex-mcp-setup.md) — company-neutral tester onboarding for STDIO or Streamable HTTP MCP servers.
- [`profiles/jira-confluence.md`](profiles/jira-confluence.md) — issue and knowledge capability expectations.
- [`profiles/zephyr-scale.md`](profiles/zephyr-scale.md) — modern Zephyr Scale capability profile.
- [`profiles/tm4j-legacy.md`](profiles/tm4j-legacy.md) — legacy Test Management for Jira, including version 6.9.0.
- [`../rules/integration-rules.md`](../rules/integration-rules.md) — neutral context bundle and mandatory read/write boundaries.
- [`../skills/collect-test-context/SKILL.md`](../skills/collect-test-context/SKILL.md) — read-only collection and routing workflow.

## Manual context is the baseline

When no integration is available, ask the user to paste or attach the relevant requirement, analysis, API example, existing case, or coverage summary. Apply the same skill and rules to that content. Missing MCP must never be treated as a skill failure.

```text
User supplies context
  ↓
Skill reads shared rules
  ↓
Result is shown in chat
```

## Optional MCP path

If suitable MCP tools are actually available and their sources are in scope, they may supply equivalent context:

```text
User supplies a reference such as an issue key
  ↓
Available read tool retrieves the issue
  ↓ optionally retrieve linked analysis or existing cases
Skill applies the same shared rules
  ↓
Result is shown in chat
```

No particular product or sequence is required. An issue tracker may supply requirements, a knowledge base may supply analysis, and a TMS may supply existing cases, but QA decisions must not depend on those product names.

### Issue-key routing

When the user supplies an issue key or URL, use `collect-test-context` to retrieve the issue, relevant linked knowledge, and existing linked cases when those read capabilities are available. Then route the neutral context bundle to the requested QA skill.

When no issue key or external link is supplied, do not search an arbitrary project. Use the context in chat or files and invoke the requested QA skill directly.

## Capability detection and fallback

1. Check whether an appropriate read or write capability is actually available.
2. Use it only for data the user has placed in scope.
3. If a read capability is missing or fails, state what content is needed and request it manually.
4. Continue the same workflow after the user supplies the content.
5. Never invent retrieved data or imply that an unavailable system was checked.

Treat Jira issue access, Confluence access, and TMS access as three independent capabilities even when one MCP server exposes all of them. A successful Jira read does not prove that vendor test objects can be read.

## Documentation corpus intake

When an integration supplies instructions or test cases for `derive-test-case-standard`, preserve the source name, location, version, scope, and approval state when available. Do not infer missing authority metadata from a folder name, workflow status, or publication date.

Retrieve only the corpus placed in scope by the user. Treat source cases as read-only evidence: derivation may propose shared rules and anonymized examples, but it must not normalize or overwrite the originals. Redact secrets, personal data, and production identifiers from any reusable example.

For Zephyr Scale XML exports, use the standard-library analyzer at [`../skills/derive-test-case-standard/scripts/summarize_zephyr_xml.py`](../skills/derive-test-case-standard/scripts/summarize_zephyr_xml.py). It reports per-project and unique case counts, duplicate-key conflicts, lifecycle values, field completeness, labels, step-level quality, and lexical simplicity-review signals without changing the export. Review signals for technical detail, vague outcomes, step-number references, or administration context require human inspection and are never automatic defects. Treat status and label values as raw metadata until their meanings are supplied by the user or an approved policy.

## Human-in-the-loop writes

Use this sequence for any change to existing external data:

```text
Context
  ↓
AI analysis
  ↓
Proposal shown in chat
  ↓
Human review
  ↓
Explicit approval or publication request
  ↓
Optional write through an available tool
```

Reading context does not authorize writing. A request only to analyze, draft, generate, update, or review does not authorize publication. An explicit request to create or publish new cases may authorize same-turn creation after validation. A reviewed existing-case proposal can be applied only after a separate explicit request and successful baseline-fingerprint recheck. Destructive operations are not exposed.

Automatic destructive changes are prohibited. This pack does not support automatic deletion of external test cases.

## Future adapters

Future client or system adapters should map external fields to the skill's neutral inputs and map reviewed outputs back to external fields. Keep credentials, endpoints, schemas, and tool instructions outside shared QA rules. Do not make an adapter a mandatory dependency of a skill.

An adapter is compatible when it can fill the neutral context bundle and preserve stable identifiers and raw external values. It does not need to use the same tool names as another company or TMS.
