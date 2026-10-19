# Agent guidance

This is a portable QA skill pack, not an application.

- For QA work, select skills by their discovery descriptions and read [rules/core.md](rules/core.md) once. Follow [intent routing](rules/task-testing-rules.md) only when routing is ambiguous or composing a package. A supplied task, source link, file or chat requirement is valid input; users do not need skill names.
- `rules/` owns policy; skills own procedures; integration profiles own transport and field mapping. Read conditional references only when applicable. Do not preload the pack or copy policy into skills. Root AGENTS.md guides repository work; installed skills must reference their shared contract themselves.
- Preserve artifact contracts. Apply [shared quality criteria](rules/core.md#качество-всех-qa-артефактов) to every output. Cases use [the case standard](rules/test-case-standard.md) and its conditional setup rules; execution uses [execution rules](rules/task-execution-rules.md); delivery uses [delivery rules](rules/checklist-delivery-rules.md).
- Under [update rules](rules/update-rules.md), previously existing cases remain proposal-only. New cases may be created and corrected in the same chat; corrections also require the MCP creation registry. Do not bypass that boundary.
- Keep changes within rules, skills, examples, agent guidance, integrations, MCP adapters and portable installer/verification scripts. Do not add an application, database, model dependency or orchestration runtime.
- Keep the development checkout separate from deployed installations. Test installers against isolated fixtures. Do not change installed skill links, client configuration or another checkout unless deployment is explicitly requested.
- Reports and test evidence belong in the project/task user-data workspace outside this repository. Installer updates must preserve that data.
- Never print secrets or store them in the repository/client config. QA writes require intent and opt-in, except Zephyr creation/same-chat correction needs no setup opt-in. Test-app actions use [execution permissions](rules/execution-access-rules.md).
- Validate structural changes with `npm test`. Routing evaluation prompts and the repeatable evaluation procedure are in [evals/README.md](evals/README.md); rerun behavioral evaluation when changing discovery descriptions, routing or artifact contracts.
- After requested repository edits and required checks, commit and push the task's changes to `main` on the configured remote unless the user explicitly selects another branch. Keep unrelated working-tree changes out of the commit.
