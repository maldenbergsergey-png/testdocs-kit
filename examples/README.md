# Examples

These deliberately small, anonymized examples demonstrate the repository's architecture and output shapes. They are not a complete QA standard and do not replace `rules/`.

## Good examples

- [`good/minimal-test-case.md`](good/minimal-test-case.md) — a compact, observable test case.
- [`good/reusable-regression-test-case.md`](good/reusable-regression-test-case.md) — a focused case designed for repeated regression execution.
- [`good/reusable-regression-test-case-ru.md`](good/reusable-regression-test-case-ru.md) — a Russian-language case using the style derived from the supplied corpus.
- [`good/shared-admin-setup-and-consumer-ru.md`](good/shared-admin-setup-and-consumer-ru.md) — a reusable Zephyr-style administration setup with an explicit output and a focused consuming case.
- [`good/regression-model-record.md`](good/regression-model-record.md) — a traceable mapping of a reusable case into regression coverage.
- [`good/coverage-matrix-record.md`](good/coverage-matrix-record.md) — a matrix scenario linked to a case without duplicating execution steps.
- [`good/coverage-create.md`](good/coverage-create.md) — a `CREATE` decision.
- [`good/coverage-update.md`](good/coverage-update.md) — an `UPDATE` decision.
- [`good/coverage-no-change.md`](good/coverage-no-change.md) — a `NO_CHANGE` decision.
- [`good/insufficient-context.md`](good/insufficient-context.md) — safe handling of missing information.
- [`good/standard-derivation.md`](good/standard-derivation.md) — evidence-backed extraction of a reusable writing rule.
- [`good/integration-context-bundle.md`](good/integration-context-bundle.md) — a read-only Jira/knowledge context bundle that preserves unavailable TMS coverage as a gap.

## Bad examples

- [`bad/minimal-test-case.md`](bad/minimal-test-case.md) — intentionally ambiguous and non-observable.
- [`bad/technical-overload.md`](bad/technical-overload.md) — a UI case made non-executable by hidden setup, vague results, and internal implementation detail.

Example labels such as item names and case IDs are fictional.
