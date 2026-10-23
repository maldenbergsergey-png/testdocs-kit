# Updating Postman collections from API contracts

Use [update-postman-collection](../skills/update-postman-collection/SKILL.md) with either supplied files or repository sources. Connection setup is optional and separate from writing the skill. Keep private values, original project documentation, collection exports and generated patches in the project/task user-data workspace, outside this portable repository.

## Input modes

| Input | Resolution |
| --- | --- |
| Attached/local YAML or JSON | Read that file; record its hash and supplied provenance. Ask for companion files only for unresolved references. |
| URL of a repository file | Resolve repository, path and ref; pin the read to a commit. |
| Branch URL | Resolve that branch head, then the declared contract path or scoped repository tree. Ask only if multiple contracts remain plausible. |
| MR URL | Use its source/head SHA and changed contract/dependency files. |
| Task-specific contract export | Use it within its declared method scope; omitted methods are not deletions. |
| Task key with a private binding | Resolve relevant linked MR/exact-key branch; then apply the bound target policy. |

Each mode also needs the collection baseline for exact editing: live Postman MCP, a collection export or a local collection file. A user can supply all materials as files and receive a ready local patch without either integration. A Git repository URL alone may require a path/ref decision; do not choose a production or staging branch by guesswork.

## Connection setup

For ongoing shared maintenance configure a primary collection Git repository under the [repository profile](profiles/git-repositories.md). Any reachable Git host can be used independently of contract sources and Postman accounts. `npm run configure:postman-repository` saves the URL, optional checkout/path/base branch and push opt-in; `npm run configure:gitlab` configures GitLab code/contract access with a server address and hidden token. Supplied-file maintenance remains available without either binding. Prefer local files for Git-backed collections; Postman MCP is optional cloud access, not Git transport.

1. In Postman, identify the intended workspace and collection, and where the shared validator lives (collection/folder/request scripts). Keep base URL and auth in environment/secret storage; separate task/staging/production targets in the project's chosen way. Do not migrate the existing collection as a setup prerequisite.
2. For optional cloud collection access, run `npm run configure:postman` in the installed pack and finish the browser login in each selected AI client. Personal-account OAuth and Full collection-management tools are configured without extra questions. The official [Postman remote MCP](https://learning.postman.com/docs/reference/postman-api/postman-mcp-server/postman-mcp-remote-server/) and [capability profile](profiles/postman.md) describe nondefault endpoints. Use the client's private credential mechanism, never a literal secret in reusable config. Inspect actual read/write tools and client permissions before relying on them.
3. For repository inputs, connect [GitLab MCP](profiles/gitlab.md) if available on the selected instance. Alternatively use an authorized read-only GitLab API/checkout, or supply the YAML directly. An unavailable MCP is not a reason to block file input.
4. Verify read access to the exact collection and contract revision. Save a private binding only if wanted: repository/contract path, branch-to-target mapping, collection/workspace IDs, validator location, optional service/tag-to-folder mapping and permitted publication mode. A path/ref or collection can instead be provided per request. Store credential references rather than credentials in that binding.
5. Prepare and inspect the candidate patch. Every added/changed method needs [runtime verification](../rules/postman-workflow-rules.md#mandatory-runtime-verification) of that candidate and its dependencies in the selected test environment, even for a one-method update. Prefer local execution without Postman account run usage or report uploads; metered/account Postman execution requires an explicit request and bounded budget. Request missing runtime prerequisites and keep the result unverified until the run is evidenced. Publish only to the intended target with write authorization; execution and publication have separate boundaries.

For a linked workflow, include the required producer/setup requests in the chosen run, preserve the collection's structure and insert consumers before cleanup. Record the input/output variable scopes and extraction points. Choose the existing authentication method or an external token/cookie reference; globals are supported when the project/user selects that scope. Supply actual secrets only through private runtime storage. Keep protected or manually initialized endpoints in the collection with their execution conditions. [Workflow rules](../rules/postman-workflow-rules.md) cover placement, prerequisites and blocked producers; an arbitrary folder-only run is not guaranteed to include setup from other folders.

The official [Postman Native Git documentation](https://learning.postman.com/docs/use/native-git/overview/) distinguishes local Git assets from cloud assets. A remote MCP connection must not be assumed to see unsynced local files; use local files for that mode. [Specification-to-collection synchronization](https://learning.postman.com/docs/design-apis/specifications/generate-collections/) can assist with generated requests, but does not by itself establish this team's custom required/types validator semantics or the intended task branch.

## Periodic or event-driven use

A skill runs when invoked or selected by a host; it does not schedule itself. A user-configured scheduler, GitLab pipeline/webhook consumer or agent host can invoke the same workflow on an explicit task/MR, relevant contract change or a chosen interval. This pack adds no service, database, model dependency or orchestration runtime.

For an unattended job, bind a source ref and destination in private configuration, resolve each run to a SHA, check the affected contract and referenced schema changes, and serialize writes per destination. Compare source and destination fingerprints before writing: source SHA alone is insufficient if somebody edited the collection. Keep patch/receipt history so a restarted job can reconcile partial success without duplicates.

Start with automatic read/compare and a reviewable patch. Unattended publication requires an explicit standing authorization for the exact source/destination and operations plus client write opt-in. Define conflict handling and leave overlapping changes for review. If the API cannot conditionally update a revision, keep publication reviewed or document the accepted race limitation before enabling it. Changes from a task branch must not be published into production expectations merely because a recurring job found them.

An event-triggered job is generally a better fit for individual task branches; periodic comparison can catch drift for explicitly selected staging/production bindings. The schedule, trigger infrastructure and actual credentials remain deployment choices, not prerequisites for this skill.
