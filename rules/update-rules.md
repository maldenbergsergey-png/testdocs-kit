# Update rules

**Status:** proposed organizational standard derived from the supplied instructions; pending human review.

Changes to a previously existing, discovered, or prior-session test case follow this sequence:

```text
Context → AI analysis → Proposal → Human review
```

The proposal must distinguish additions, modifications, removals, and unchanged content, and explain every proposed change. Show the complete proposed case after the diff.

The only external-write exception is a user-requested correction to a case created by the same running MCP process. That path still requires a source-backed diff and complete final version, but the explicit correction request authorizes applying it immediately under the registry checks below.

## Source and version procedure

Before proposing an update:

1. Read the latest TMS comment that explains why actualization is needed.
2. If no comment exists, inspect the latest version history and identify the person whose change triggered the status; request the reason instead of guessing.
3. Establish the requirement, design, defect, or approved correction that supports the change.
4. For a significant change, create a new TMS version so history is preserved rather than editing the current version directly.

If the team later applies the reviewed update outside this tool:

1. Save the changed steps, expected results, preconditions, test data, requirement links, designs, path, tags, priority, or cleanup as applicable.
2. Leave a concise comment describing the reason and affected content.
3. Move the case to `Готов к ревью`.
4. Check whether related cases are affected by the same product change.

Reading a comment or history does not authorize a write. Except for the narrowly verified current-session correction below, external updates, version creation, saving, commenting, linking, moving, and status changes remain disabled; provide a reviewed proposal only.

## Current-session correction exception

A user may explicitly request an immediate correction to a case that the connected MCP process created earlier in the same running session. Apply the correction only when the server-side in-memory registry contains that exact returned case key. This exception is intended for fixing a just-created draft before handoff.

- Read the just-created case or use its complete returned/current content as the baseline.
- Apply only the requested, source-supported correction and preserve omitted fields.
- If steps change, submit the complete final ordered list; never send a partial step list as though it were a patch.
- Report the changed fields and the returned case key after the operation.
- Do not create a new version, move the case, add a comment, change workflow status implicitly, link new objects after creation, or delete anything.

If the key came from search, existed before the session, was created by another client or earlier MCP process, or is absent from the registry, stop at a proposal. Restarting the MCP process intentionally removes update eligibility. Never bypass this boundary based on conversational memory or a user-supplied assertion alone.

## Add content

Add a precondition, datum, step, or expected result only when the new context makes it necessary to execute or prove the existing case's primary intent. Create a separate case when the content introduces an independent initial state, path, or materially different outcome whose failure should be diagnosed separately.

## Modify content

Modify an action, datum, sequence, or expected result only when supplied evidence shows that the current content is inaccurate, incomplete, non-reproducible, or inconsistent with the intended contract.

- Preserve the original meaning and formatting when they remain valid.
- Change only the smallest coherent portion needed for correctness and reusability.
- Keep source-defined exact values or wording when they remain part of the contract.
- Do not modernize terminology, reorganize steps, or normalize style without identifying that as a separate proposed change.

## Modify expected results

Tie each changed result to the new observable behavior and preserve unaffected assertions. Do not replace a specific supported result with a generic success statement. Do not add internal verification surfaces unless they are explicitly in scope.

## Remove obsolete content

Propose removal only when supplied evidence shows that the content is obsolete, unsupported, duplicated within the same case, unsafe, or outside the case's primary intent. Quote or locate the removed content and explain the evidence.

Removal from the proposed document is reviewable. Automatic deletion of a test case from an external system is not supported.

## Preserve regression reusability

After the change, verify that the case remains repeatable, focused, observable, diagnosable, and independent where practical. Parameterize transient values, clarify setup and cleanup, or recommend splitting the case when new behavior would otherwise make it brittle.

Do not expand a case solely to collect all related checks. Preserve the smallest coherent regression scenario that proves the intended behavior.

## Reusable setup changes

When the case consumes or provides reusable setup:

- preserve the named setup reference and output contract when they remain valid;
- update the shared procedure once instead of copying the same preparation change into every consumer;
- identify all supplied consuming cases when the setup output, validity, required access, or cleanup changes;
- update a consumer only when its reference, consumed output, own starting state, or tested behavior changes;
- do not silently convert a setup helper into regression coverage of the administration interface.

## Avoid unjustified rewrites

Do not rewrite an entire case by default. Preserve unaffected content and formatting where possible. A complete rewrite requires a specific reason, such as an approved structural migration or a current structure that prevents a safe localized update. Show how the rewrite preserves supported coverage.

The approved Russian Zephyr format in `test-case-standard.md` is the target format for every complete proposed version. Migrating an existing legacy format is a structural change: show it separately in the proposed diff and do not publish it without human approval.

## Context and conflict handling

- Require the supplied current case and new authoritative context.
- Identify ambiguity, contradictions, and missing source versions.
- Do not silently choose between conflicting requirements.
- Do not infer unseen fields or reconstruct an unavailable baseline.
- Label all output as a proposal until the user approves it.
- Do not use an external write tool for a previously existing, discovered, or prior-session case. Only the explicit current-session correction exception above may be applied externally.
