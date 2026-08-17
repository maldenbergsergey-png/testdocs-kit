# Test case type rules

**Status:** proposed transcription of the supplied organizational instructions; pending human review.

Every test case must have at least one type tag. Multiple type tags are allowed when the case genuinely covers more than one level, for example `block` + `integration`.

## Type selection

| Type | Tag | Primary question |
| --- | --- | --- |
| End-to-End | `e2e` | Does the complete business process work from start to a recorded result? |
| Page-Level / Overview | `overview` | Does the page load and basically function? |
| Block-Level | `block` | Does a specific block work according to requirements? |
| Cross-Page | `cross` | Do transitions, parameters, and context work between blocks or pages? |
| Integration | `integration` | Do system components or services exchange and process data correctly? |

Type and priority are separate decisions. Type defines the case's purpose and depth; priority reflects business and user impact.

## E2E

Use `e2e` only for a completed user business process that changes system state or creates a recorded business entity. Include:

- the starting system state;
- the user action sequence;
- key control points across the process;
- transfer and preservation of data between pages;
- the confirmed final business result.

Do not include exhaustive UI checks, detailed negative variants for each field, or isolated block validation. These belong in focused cases.

Use 5–15 steps as an orientation. When the case exceeds 15 steps, review whether it should be decomposed without losing the completed business result.

## Overview

Use `overview` for a fast page-level check of basic availability. Include page loading, main blocks, key actions, and basic navigation. Do not include full block logic, all states, or detailed boundary values.

Use 3–8 steps as an orientation.

## Block

Use `block` for the logic of one specific block or component. Cover its relevant elements, states, display logic, and reactions to actions. Do not expand into unrelated blocks or site-wide journeys.

Use 5–12 steps as an orientation. More than 15 steps is a strong signal that the block or scenario boundary is too broad.

## Cross-page

Use `cross` for dependencies between blocks or behavior across pages. Verify state changes, parameter transfer, and contextual behavior. Do not classify a completed business flow as `cross` when it satisfies the `e2e` definition.

## Integration

Use `integration` for interaction with an internal or external component or service. Include the integration point, request or event trigger, result verification, and error handling supported by the contract.

Technical detail may be necessary in integration cases, but it must remain relevant to the contract and executable by the intended tester.

## Overload and decomposition

A case is overloaded when it:

- verifies more than one business scenario;
- includes checks unrelated to its primary purpose;
- contains alternative branches inside one case;
- includes unnecessary technical detail, except where integration verification requires it.

If the case contains several independent conditions, split them. The word “and” is a review signal, not an automatic split rule: keep assertions together when they prove one coherent outcome.

## Platform tags

Every case must also identify its platform or application area with an approved tag:

- `web` — desktop website;
- `app` — mobile application;
- `web_mobile` — adaptive mobile website.

Add `админка` when the case verifies behavior of an administration interface itself: its fields, validation, permissions, actions, states, or results. This tag is additional to the required type and platform tags. Do not add `админка` merely because an administration interface is used as a reusable setup surface for a case that verifies another product surface.

Do not invent a platform tag when the target surface is not supplied. Request the missing classification.
