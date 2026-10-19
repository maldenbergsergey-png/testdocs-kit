import test from "node:test";
import assert from "node:assert/strict";
import { withChecklistPublicationApproval as protect } from "./opencode-checklist-permissions.mjs";

const tool = "testdocs_jira_jira_publish_checklist_comment";
const servers = [{ name: "testdocs_jira", service: "jira", tools: ["get_issue", "jira_publish_checklist_comment"] }];

test("stable blocks silent publication despite permissive defaults, without gating reads", () => {
  const original = { permission: { [tool]: "allow", "testdocs_*": "allow", bash: "ask" } };
  const result = protect(original, "stable", servers);
  assert.equal(result.permission[tool], "ask");
  assert.equal(Object.keys(result.permission).at(-1), tool);
  assert.equal(result.permission["testdocs_*"], "allow");
  assert.equal(result.permission.bash, "ask");
  assert.equal(original.permission[tool], "allow");
  assert.deepEqual(protect(result, "stable", servers), result);
});

test("stable shorthand retains unrelated policy and existing denies stay denied", () => {
  for (const permission of ["allow", "ask", "deny"]) {
    const result = protect({ permission }, "stable", servers);
    assert.equal(result.permission["*"], permission);
    assert.equal(result.permission[tool], permission === "deny" ? "deny" : "ask");
  }
  for (const permission of [{ "testdocs_jira*": "deny" }, { [tool]: "deny" }, { [tool]: { "*": "deny" } }]) {
    assert.equal(protect({ permission }, "stable", servers).permission[tool], "deny");
  }
  assert.equal(protect({ permission: { "*": "deny", [tool]: "allow" } }, "stable", servers).permission[tool], "ask");
});

test("agent overrides require approval while agents that inherit a deny stay denied", () => {
  for (const effect of ["allow", "deny"]) {
    const result = protect({ permission: effect, agent: { build: { permission: "allow", model: "local/model" }, review: { permission: "deny" }, inherit: {} } }, "stable", servers);
    assert.equal(result.agent.build.permission[tool], "ask");
    assert.equal(result.agent.review.permission[tool], "deny");
    assert.equal(result.agent.inherit.permission[tool], effect === "deny" ? "deny" : "ask");
    assert.equal(result.agent.build.model, "local/model");
  }
});

test("V2 appends exact ask after broad allow and preserves unrelated rules and agent denies", () => {
  const allow = { action: "*", resource: "*", effect: "allow" };
  const deny = { action: tool, resource: "*", effect: "deny" };
  const result = protect({ permissions: [allow], agents: { build: { permissions: [allow] }, review: { permissions: [deny] } } }, "v2", servers);
  const ask = { action: tool, resource: "*", effect: "ask" };
  assert.deepEqual(result.permissions, [allow, ask]);
  assert.deepEqual(result.agents.build.permissions, [allow, ask]);
  assert.deepEqual(result.agents.review.permissions, [deny]);
  assert(!Object.hasOwn(result, "permission"));
  assert.deepEqual(protect(result, "v2", servers), result);
  const blocked = protect({ permissions: [{ action: "testdocs_*", resource: "*", effect: "deny" }] }, "v2", servers);
  assert.equal(blocked.permissions.at(-1).effect, "deny");
});

test("each enabled Jira instance gets its own approval, no opt-in means no new gate", () => {
  const many = [
    { ...servers[0], name: "testdocs_jira_jira_one" },
    { ...servers[0], name: "testdocs_jira_jira_two" },
    { ...servers[0], name: "testdocs_jira_disabled", tools: ["get_issue"] }
  ];
  const result = protect({}, "stable", many);
  assert.deepEqual(result.permission, {
    testdocs_jira_jira_one_jira_publish_checklist_comment: "ask",
    testdocs_jira_jira_two_jira_publish_checklist_comment: "ask"
  });
  for (const format of ["stable", "v2"]) assert.deepEqual(protect({}, format, [many[2]]), {});
  const unrelated = { permission: { custom: "ask" }, mcp: { servers: { browser: {} } } };
  assert.deepEqual(protect(unrelated, "v2", []), unrelated);
});

test("client-format migration keeps exact publication denies and does not erase foreign rules", () => {
  const stable = { permission: { [tool]: "deny" } };
  const v2 = protect(stable, "v2", servers);
  assert.deepEqual(v2.permissions, [{ action: tool, resource: "*", effect: "deny" }]);
  assert.deepEqual(protect(v2, "stable", servers), stable);
  assert.throws(() => protect({ permission: { bash: "deny" } }, "v2", servers), /Migrate those permissions/);
  assert.throws(() => protect({ permissions: [{ action: "bash", resource: "*", effect: "deny" }] }, "stable", servers), /Migrate those permissions/);
  assert.throws(() => protect({ permission: [] }, "stable", servers), /Invalid OpenCode/);
  assert.throws(() => protect({ permissions: "allow" }, "v2", servers), /Invalid OpenCode/);
});
