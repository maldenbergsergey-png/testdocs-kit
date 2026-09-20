# Shared rules

This directory is the source of truth for QA test-documentation policy. Skills define procedures; these files define standards and decision criteria.

Read [core.md](core.md) once per task. This index is for discovery; follow only the rules relevant to the selected workflow.

## Rule files

- [`test-case-standard.md`](test-case-standard.md) — test-case content and writing standard.
- [`test-checklist-standard.md`](test-checklist-standard.md) — task- or document-scoped Jira checklist contract.
- [`bug-report-standard.md`](bug-report-standard.md) — bug summary/content contract, live Jira field mapping, defaults, and creation boundary.
- [`task-testing-rules.md`](task-testing-rules.md) — intent routing for checklist, full-package, cases-only, task-scoped, optimization, review, and targeted workflows.
- [`qa-task-estimation-rules.md`](qa-task-estimation-rules.md) - QA effort estimation, platform scope, base work, regression, retest, risk reserve, and package totals.
- [`qa-estimation-team-rules.md`](qa-estimation-team-rules.md) - scoped team criteria, private persistence, recalculation, and estimate-versus-actual comparisons.
- [`qa-estimation-profile.md`](qa-estimation-profile.md) - published starting process for component checks, documentation, AI validation, environments, and risk analysis.
- [`qa-estimation-platform-matrix.md`](qa-estimation-platform-matrix.md) - scoped desktop/mobile web, design breakpoints, and native iOS/Android coverage from the supplied matrices.
- [`task-execution-rules.md`](task-execution-rules.md) — execution workflow with conditional surface, report and evidence contracts.
- [`test-case-type-rules.md`](test-case-type-rules.md) — E2E, overview, block, cross-page, integration, and platform classification.
- [`test-case-lifecycle-rules.md`](test-case-lifecycle-rules.md) — lifecycle statuses, review readiness, and task linkage.
- [`reusable-setup-rules.md`](reusable-setup-rules.md) — shared preparation procedures, administration content, dependency outputs, and cleanup.
- [`integration-rules.md`](integration-rules.md) — optional issue, knowledge, and TMS capability contract plus read/write boundaries.
- [`coverage-rules.md`](coverage-rules.md) — permanent coverage decision rules.
- [`coverage-matrix-rules.md`](coverage-matrix-rules.md) — functionality decomposition and scenario-to-case mapping.
- [`regression-model-rules.md`](regression-model-rules.md) — construction and maintenance of a traceable regression coverage model.
- [`test-run-rules.md`](test-run-rules.md) — release Test Run discovery, eligibility, depth, assignment, and creation rules.
- [`update-rules.md`](update-rules.md) — safe changes to existing cases.
- [`review-rules.md`](review-rules.md) — review criteria and finding severity.
- [`standard-derivation-rules.md`](standard-derivation-rules.md) — evidence and approval rules for deriving shared policy from a documentation corpus.
- [`project-conventions.md`](project-conventions.md) — cross-company isolation rules for runtime-only project conventions.


## Conditional rule modules

- [task-explanation-rules.md](task-explanation-rules.md): advice-only requests.
- [test-case-format.md](test-case-format.md): rendering complete cases; [test-case-setup-rules.md](test-case-setup-rules.md): administration assertions and property-specific hints.
- [execution-web-rules.md](execution-web-rules.md), [execution-native-rules.md](execution-native-rules.md), [execution-media-rules.md](execution-media-rules.md): selected surface only.
- [browser-session-rules.md](browser-session-rules.md): browser selection, reuse of readable sources and necessary authentication recovery.
- [execution-report-rules.md](execution-report-rules.md): statuses and report; [execution-evidence-rules.md](execution-evidence-rules.md): capture, reuse and local history.
- [tms-integration-rules.md](tms-integration-rules.md): TMS compatibility; [external-write-rules.md](external-write-rules.md): requested writes; [checklist-delivery-rules.md](checklist-delivery-rules.md): requested Jira/QA Report delivery.
