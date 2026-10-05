# Codex model roles

Use only when model delegation is explicitly enabled. Apply [portable model-role rules](../../rules/model-routing-rules.md); keep source policy in [context reuse rules](../../rules/context-reuse-rules.md).

The selected chat model remains the main analyst. Codex can spawn a bounded extractor or reviewer with another model and return its result to that chat. Skill prose does not change the chat's model. Without an explicit or configured subagent selection, the client's inherited/default selection applies. Current local Codex supports role files under `.codex/agents/` or `~/.codex/agents/`; the client loads them for spawned sessions. Check actual version and model availability before using a mapping. [Official OpenAI documentation](https://learn.chatgpt.com/docs/agent-configuration/subagents).

## Optional role templates

- [qa-context-extractor.toml](../templates/codex/qa-context-extractor.toml): literal scoped extraction using an example lower-cost model.
- [qa-focused-reviewer.toml](../templates/codex/qa-focused-reviewer.toml): evidence-focused review using an example analyst model.

These are templates, not installed settings. Deploy only on an explicit deployment request. Copy the chosen files to the user's intended project/personal agent directory, replace model/effort with supported choices, and retain current sandbox/approval and MCP boundaries. Do not configure a global default that makes every subagent use an extraction model. Ordinary kit installation/update leaves model choice unchanged. Other clients need their own verified role mapping.

When the user enables the roles, e.g. "Use model roles: delegate the large source inventory to qa-context-extractor; keep requirements and final checklist in this chat", follow the conditional procedure in `collect-test-context`. Pass the exact source scope, platform, common contract and resource root. For fresh-context spawning, include these explicitly; an agent without chat history must still know the applicable rules. Return a compact index plus complete referenced sections, conflicts and gaps. The main agent saves context and produces only the requested artifact. A reviewer is optional for a concrete consequential uncertainty.

If custom-agent selection is unavailable but the live spawning capability accepts a model, pass the supported role model and compatible context mode explicitly. If neither is available, keep the task in the selected model. Do not claim that a template or role name by itself invoked another model.

Additional agents consume their own tokens. Measure all calls and handoffs; a short output from an extractor is not proof of a cheaper task. API prompt caching is a separate provider mechanism. [Official OpenAI documentation](https://developers.openai.com/api/docs/guides/prompt-caching).
