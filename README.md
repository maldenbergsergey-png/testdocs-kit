# QA Test Documentation Skill Pack

`qa-test-docs` is a repository-based set of shared rules, AI skills, and examples for creating and maintaining QA test documentation. It is intended for QA engineers and teams that want consistent agent behavior across AI clients and coding agents.

This repository is a **skill pack, not an application**. It has no UI, backend, database, API server, container, model wrapper, or required external service.

> The core QA logic must remain independent of Codex, Claude Code, OpenCode, Jira, Zephyr, Confluence, and other specific tools.

## Design principles

- `rules/` is the single source of truth for QA documentation policy.
- Skills contain workflows and reference the shared rules; they do not copy those rules.
- Supplying context directly in chat is a first-class, fully supported workflow.
- MCP and other integrations are optional ways to read or publish context.
- Missing facts are reported, never invented.
- Test cases use minimum sufficient detail so a tester unfamiliar with the project can execute them without oral guidance.
- Repeated administration or data preparation is modeled as an explicit reusable setup dependency, not copied into every case.
- Changes to existing data are proposals until a human reviews and approves them.
- External write operations require an explicit user request or confirmation.
- Automatic destructive changes, including deletion of external test cases, are out of scope.

## Repository layout

```text
qa-test-docs/
├── README.md
├── AGENTS.md
├── rules/
├── skills/
├── examples/
└── integrations/
```

Each skill contains a portable `SKILL.md`. Optional `agents/openai.yaml` files improve discovery in Codex-compatible clients; they contain no QA logic and may be ignored or replaced by other clients.

## Rules

The files in [`rules/`](rules/) define the intended standard:

- [`test-case-standard.md`](rules/test-case-standard.md): structure and writing conventions for test cases.
- [`test-case-type-rules.md`](rules/test-case-type-rules.md): case-level and platform classification.
- [`test-case-lifecycle-rules.md`](rules/test-case-lifecycle-rules.md): status meanings and review readiness.
- [`reusable-setup-rules.md`](rules/reusable-setup-rules.md): reusable preparation, administration content, dependency outputs, and cleanup.
- [`coverage-rules.md`](rules/coverage-rules.md): criteria for `CREATE`, `UPDATE`, `NO_CHANGE`, and `INSUFFICIENT_CONTEXT` decisions.
- [`coverage-matrix-rules.md`](rules/coverage-matrix-rules.md): decomposition of functionality into matrix scenarios and linked cases.
- [`regression-model-rules.md`](rules/regression-model-rules.md): criteria for organizing persistent cases into a traceable regression coverage model.
- [`update-rules.md`](rules/update-rules.md): constraints for changing existing test cases.
- [`review-rules.md`](rules/review-rules.md): review criteria and finding format.
- [`standard-derivation-rules.md`](rules/standard-derivation-rules.md): controlled derivation of reusable policy from instructions and test-documentation corpora.

These files provide an organizational QA standard derived from the supplied instructions, with a project-independent core for reusable regression cases. Remaining ambiguities are explicit and require human review. Do not hide policy inside a skill.

## Available skills

| Skill | Responsibility |
| --- | --- |
| [`derive-test-case-standard`](skills/derive-test-case-standard/SKILL.md) | Extract evidence-backed universal rules and style patterns from supplied QA documentation. |
| [`build-coverage-matrix`](skills/build-coverage-matrix/SKILL.md) | Decompose product scope and map matrix scenarios to existing or proposed cases. |
| [`build-regression-model`](skills/build-regression-model/SKILL.md) | Organize persistent cases into a traceable model and identify evidence-backed gaps or overlaps. |
| [`generate-test-cases`](skills/generate-test-cases/SKILL.md) | Produce new test cases from supplied context. |
| [`analyze-test-coverage`](skills/analyze-test-coverage/SKILL.md) | Classify the effect of a change on permanent test coverage. |
| [`update-test-cases`](skills/update-test-cases/SKILL.md) | Propose a reasoned diff and revised version of an existing test case. |
| [`review-test-cases`](skills/review-test-cases/SKILL.md) | Review test cases against repository rules without silently rewriting them. |

## Use without MCP

No integration is required. Give the agent requirements, analysis, API examples, existing documentation, or test cases directly, then ask it to use the appropriate skill.

```text
User
  ↓ supplies requirements / description / existing test case
AI applies a skill
  ↓ reads repository rules
Result appears in chat
```

If required context is missing, the skill returns a precise list of missing facts and stops before inventing requirements.

## Use with MCP

When suitable MCP tools are actually available, an agent may use them to retrieve the same inputs from systems such as an issue tracker, knowledge base, or TMS. The QA reasoning and output format remain unchanged.

External publication is a separate, optional step. The agent must first show the proposed content, wait for human review, and use a write tool only after the user explicitly requests or confirms that write. See [`integrations/README.md`](integrations/README.md).

## Extend the rules

1. Collect approved instructions and representative test documentation.
2. Use `derive-test-case-standard` to separate universal rules from examples and project-specific conventions.
3. Review the traceable proposal with QA stakeholders.
4. Edit the relevant file under `rules/` after approval.
5. Check whether skills and examples need updating.
6. Keep skills linked to the rule file instead of copying the new policy into them.

## Add a skill

1. Create `skills/<verb-led-name>/SKILL.md` with `name` and `description` frontmatter.
2. Give the skill one clear responsibility, inputs, workflow, and output contract.
3. Link directly to every applicable file in `rules/`.
4. Support manually supplied context and treat integrations as optional.
5. Define missing-context behavior and human approval boundaries.
6. Add portable examples and validate the skill structure.

## Adapt to another AI client

Keep `rules/`, examples, and the Markdown skill instructions unchanged where possible. Add only the thin discovery or invocation metadata required by the target client. Client-specific metadata must not contain QA policy, require a particular LLM, or change human-review safeguards.

## Current maturity

Ready now:

- repository architecture and source-of-truth boundaries;
- seven skill workflows and output contracts, including corpus-based standard derivation, coverage matrices, and regression modeling;
- an instruction-backed standard for simple, self-explanatory, typed, repeatable, observable regression cases and coverage matrices;
- reusable setup procedures for administration content and other shared data preparation;
- manual-context and optional-MCP paths;
- human-in-the-loop write safeguards;
- minimal architecture examples.

Remaining decisions to customize or confirm:

- automation-candidate criteria and tooling metadata;
- finding severity thresholds;
- mapping of the observed `Draft` status to the instructed `Черновик` status;
- mapping of the observed `Normal` priority to the instructed conceptual `Medium` priority;
- integration placement in the coverage matrix because the supplied source section is incomplete;
- mappings to particular issue trackers, knowledge bases, or TMS schemas.
