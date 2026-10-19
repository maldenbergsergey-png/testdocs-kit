# Model roles and bounded delegation

Load when the user explicitly requests model roles/subagents or an explicitly enabled client/project policy supplies role mappings. Ordinary QA work stays with the selected chat model. This portable pack defines roles, not an orchestration runtime or model dependency.

## Select work by need

| Role | Suitable work | Escalation |
| --- | --- | --- |
| Deterministic helper | Local discovery, source-version comparison, format validation and payload comparison through existing scripts | Return an actual error or unsupported input to the main agent |
| Context extractor | A large, clearly scoped source inventory or literal fact extraction with exact provenance | Missing inventory items, ambiguous behavior or conflicting sources go to the main agent |
| Main analyst | Intent/scope, requirements, platform differences, coverage, risk decisions and final artifact | Use a stronger supported model/effort only for an actual unresolved decision |
| Focused reviewer | A bounded ambiguity or a consequential coverage/requirement decision when independent review adds value | Return findings and evidence; the main agent resolves the requested result |

Use scripts before models for mechanical work. Small tasks need no subagent. Do not automatically send every artifact through extraction, analysis and review.

## Delegation contract

- When delegation is explicitly enabled and a substantial extraction task warrants it, delegate that bounded task using the client's verified model mapping. Keep the main analyst in the selected chat. Use the [Codex profile](../integrations/profiles/codex-model-routing.md) only for Codex; check other clients' actual capabilities rather than transplanting its config.
- An unset model inherits the client's parent/default behavior. Do not claim a cheaper model ran unless its selection is confirmed. If the requested model or delegation is unavailable, continue with the selected chat model and state the material limitation once. Do not install a model SDK or silently alter user configuration.
- Give a subagent the exact task, selected source material or narrowly scoped references, target platform, applicable shared rules/resource root and required output. Prefer a fresh or minimal context where supported; do not fork the entire chat just for convenience. Model overrides must use a context mode supported by that client.
- Request source facts, a complete field inventory, exact provenance, conflicts and gaps. Long inventories may be saved in local sections with a compact index returned to the parent; a response budget must not silently truncate requirements.
- Subagents inherit the user's scope and write boundaries. Extraction and review are read-only with respect to external systems. The main agent handles authorized artifact delivery and its live preflight; delegation grants no additional permissions.
- Judge outputs by inventory completeness and evidence, not a model's self-reported confidence. Retry a concrete extraction failure at most once with the missing scope, then handle it in the main agent. Contradictory or inaccessible sources remain unresolved when no authoritative decision exists.

## Measure the whole task

Count main-agent and subagent input/output, reasoning, retries and handoffs where the client exposes usage. Record unknown usage as unknown; character counts are not exact token counts. Compare total task cost and time alongside missed requirements and manual corrections. A cheaper model can reduce cost without reducing token count; additional agents can increase both. Prompt caching is provider-specific and is separate from saved cross-task context.
