const test = require("node:test");
const assert = require("node:assert/strict");
const { exposeEvaTool } = require("./eva-policy");

test("Eva proxy exposes scoped reads", () => {
  assert.equal(exposeEvaTool({ name: "eva_task_get" })?.name, "eva_task_get");
  assert.equal(exposeEvaTool({ name: "eva_comment_list" })?.name, "eva_comment_list");
  assert.equal(exposeEvaTool({ name: "eva_document_get" })?.name, "eva_document_get");
});

test("Eva proxy hides every mutation", () => {
  for (const name of ["eva_task_create", "eva_task_update", "eva_task_delete", "eva_task_archive", "eva_comment_create", "eva_document_update"]) {
    assert.equal(exposeEvaTool({ name }), null, `${name} must stay hidden`);
  }
});
