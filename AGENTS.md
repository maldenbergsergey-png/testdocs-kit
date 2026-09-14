# Agent guidance

This is a portable QA skill pack, not an application.

- For QA work, select skills by their discovery descriptions and read [rules/core.md](rules/core.md) once. Follow [intent routing](rules/task-testing-rules.md) only when routing is ambiguous or composing a package. A supplied task, source link, file or chat requirement is valid input; users do not need skill names.
- `rules/` owns policy; skills own procedures; integration profiles own transport and field mapping. Read conditional references only when applicable. Do not preload the pack or copy policy into skills. Root AGENTS.md guides repository work; installed skills must reference their shared contract themselves.
- Preserve artifact requirements when editing routing or layout. Case quality and format live in [the case standard](rules/test-case-standard.md), including its conditional setup references. Execution uses [execution rules](rules/task-execution-rules.md); delivery uses [delivery rules](rules/checklist-delivery-rules.md).
- The temporary restriction in [update rules](rules/update-rules.md) is intentional: cases created outside the current MCP process remain proposal-only. Do not enable an alternative write path as a refactoring shortcut.
- Keep changes within rules, skills, examples, agent guidance, integrations, MCP adapters and portable installer/verification scripts. Do not add an application, database, model dependency or orchestration runtime.
- Keep the development checkout separate from deployed installations. Test installers against isolated fixtures. Do not change installed skill links, client configuration or another checkout unless deployment is explicitly requested.
- Reports and test evidence belong in the project/task user-data workspace outside this repository. Installer updates must preserve that data.
- Keep credentials outside the repository and client configuration; never print secrets. External write tools are disabled by default and require opt-in plus explicit operation intent.
- Validate structural changes with `npm test`. Routing evaluation prompts and the repeatable evaluation procedure are in [evals/README.md](evals/README.md); rerun behavioral evaluation when changing discovery descriptions, routing or artifact contracts.
