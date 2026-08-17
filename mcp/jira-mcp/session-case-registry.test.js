const test = require("node:test");
const assert = require("node:assert/strict");

const { createSessionCaseRegistry } = require("./session-case-registry");

test("session registry allows only keys returned by creation in this process", () => {
  const registry = createSessionCaseRegistry();

  assert.equal(registry.recordCreated({ key: "DEMO-T12" }), "DEMO-T12");
  assert.equal(registry.has("DEMO-T12"), true);
  assert.doesNotThrow(() => registry.assertEditable("DEMO-T12"));
  assert.throws(
    () => registry.assertEditable("DEMO-T11"),
    /only cases created by this MCP process during the current session/
  );
});

test("session registry does not invent a key when creation response has none", () => {
  const registry = createSessionCaseRegistry();

  assert.equal(registry.recordCreated({ id: 123 }), null);
  assert.throws(() => registry.assertEditable("DEMO-T123"));
});
