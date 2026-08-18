# Agent guidance

This repository is a portable skill pack for QA test documentation, not an application.

- Treat `rules/` as the source of truth. Read every rule file referenced by the active skill; do not duplicate or override policy inside a skill.
- Route by user intent; never require the user to know a skill name. A task plus checklist intent uses `prepare-task-testing` → checklist branch. A generic or full task-testing request uses `prepare-task-testing` → full-package branch. Generate-only uses `generate-test-cases`; a specific-case update uses `update-test-cases`; review uses `review-test-cases`; coverage-only uses `analyze-test-coverage`; matrix uses `build-coverage-matrix`; regression organization uses `build-regression-model`; corpus/rule derivation uses `derive-test-case-standard`. Direct skill calls remain supported.
- Keep task checklists distinct from permanent Test Cases. A checklist captures task-specific verification; permanent cases require durable regression value.
- Work only from context available to the user, whether supplied in chat, local files, or an available integration.
- Never invent missing requirements, system behavior, identifiers, test data, or existing coverage. State material gaps explicitly.
- Prefer minimum sufficient detail: every case must be executable by a tester unfamiliar with the project, while UI cases must not be overloaded with internal implementation detail.
- Model repeated administration or data preparation as an explicit reusable setup dependency with a defined output; do not rely on hidden case order.
- Treat MCP and external systems as optional. If a needed integration is unavailable, ask for the relevant context manually and continue when it is supplied.
- When an issue key or external link is supplied, anchor retrieval to it and use `collect-test-context`; without a key or link, do not search an arbitrary company system.
- Treat Jira, Confluence, and TMS access as independent capabilities. Never claim that existing cases were checked when only Jira issues were readable.
- Show results in chat by default.
- Treat every change to existing documentation as a proposal for human review. Review output includes a complete corrected proposal when findings affect content.
- Use an external write operation only after an explicit user request or confirmation. Existing-case updates must re-read and pass the connector's stale-proposal check. Never automatically perform destructive changes or delete external test cases; use `RETIRE_PROPOSAL` for reviewable retirement recommendations.
- Publishing a finalized checklist to a Jira comment or sending it to QA Report are separate optional writes. Perform either only when the user explicitly asks for that destination. A QA Report editor URL may be opened only as a separate external browser tab/window, never embedded.
- Keep edits focused on rules, skills, examples, agent guidance, integrations, MCP adapters, and their portable installer or verification scripts. Do not add an application, service, database, model dependency, or orchestration runtime.
- Keep credentials outside the repository and client configuration. Installer output must not print secrets, and external write tools must remain disabled by default.
