# Agent guidance

This repository is a portable skill pack for QA test documentation, not an application.

- Treat `rules/` as the source of truth. Read every rule file referenced by the active skill; do not duplicate or override policy inside a skill.
- Use the skill in `skills/` that matches the requested task: collect explicitly referenced external context, derive a standard from a corpus, build a coverage matrix, generate, build a regression model, analyze coverage, propose updates, or review.
- Work only from context available to the user, whether supplied in chat, local files, or an available integration.
- Never invent missing requirements, system behavior, identifiers, test data, or existing coverage. State material gaps explicitly.
- Prefer minimum sufficient detail: every case must be executable by a tester unfamiliar with the project, while UI cases must not be overloaded with internal implementation detail.
- Model repeated administration or data preparation as an explicit reusable setup dependency with a defined output; do not rely on hidden case order.
- Treat MCP and external systems as optional. If a needed integration is unavailable, ask for the relevant context manually and continue when it is supplied.
- When an issue key or external link is supplied, anchor retrieval to it and use `collect-test-context`; without a key or link, do not search an arbitrary company system.
- Treat Jira, Confluence, and TMS access as independent capabilities. Never claim that existing cases were checked when only Jira issues were readable.
- Show results in chat by default.
- Treat every change to existing documentation as a proposal for human review.
- Use an external write operation only after an explicit user request or confirmation. Never automatically perform destructive changes or delete external test cases.
- Keep edits focused on rules, skills, examples, agent guidance, integrations, MCP adapters, and their portable installer or verification scripts. Do not add an application, service, database, model dependency, or orchestration runtime.
- Keep credentials outside the repository and client configuration. Installer output must not print secrets, and external write tools must remain disabled by default.
