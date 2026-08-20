# Project-convention isolation

**Status:** portable cross-project rule.

The shared skill pack must remain company-, tenant-, and project-neutral. Project conventions are runtime context, not portable policy.

## Isolation boundary

- Do not store company names, internal domains, Jira project keys, direction or brand names, user identities, component lists, label formats, environment URLs, sprint rules, custom-field IDs, or team routing in shared rules, skills, examples, installer defaults, or client configuration.
- Obtain project-specific values only from context explicitly supplied for the current request, an anchored source in the connected Jira/knowledge system, live Jira create metadata, or a user-approved private configuration outside the repository.
- Scope every discovered convention to its exact Jira instance and project. Do not reuse it for another project on the same instance unless the source explicitly defines that wider scope.
- Reset project-specific assumptions when the target Jira instance, project, or company changes. Similar field names or project structures are not evidence of shared configuration.
- Do not reveal conventions discovered in one tenant while working in another tenant.

## Runtime convention inventory

When relevant to the request, record only source-backed values for the current scope:

```text
Jira instance and project: ...
Source and stated scope: ...
Issue and subtask types: ...
Required fields and custom-field IDs: ...
Environment names and exact URLs: ...
Components, labels, priorities, and allowed values: ...
Assignment or specialist rules: ...
Product directions, brands, streams, aliases, and precedence: ...
Release, parent/subtask, sprint, and escalation rules: ...
Source conflicts or missing decisions: ...
```

Keep this inventory in the current task context. Do not commit it to the portable repository.

## Portable behavior

- Keep one base case for behavior shared across supported product directions or variants.
- Create delta-only cases for source-backed differences and link the common base case first.
- Use direction, brand, stream, environment, component, and label names exactly as supplied for the current project; never substitute a name learned elsewhere.
- For bug reports, treat environment categories such as development, staging, and production as portable concepts, but resolve their exact names and URLs from the current project.
- Read live Jira metadata before creation even when a project instruction supplies field names; the connected Jira schema is authoritative for writable field IDs and allowed values.

If a material convention cannot be resolved from the current scope, omit optional routing or request the missing value before a required write. Never fill the gap from another company's configuration.
