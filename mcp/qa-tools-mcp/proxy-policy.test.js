const test = require("node:test");
const assert = require("node:assert/strict");
const { buildMcpUrl, exposeTool, prepareCall } = require("./proxy-policy");

test("builds the official QA Tools MCP endpoint", () => {
  assert.equal(buildMcpUrl("https://qa-tools.company.example/").toString(), "https://qa-tools.company.example/api/mcp");
  assert.throws(() => buildMcpUrl("file:///tmp/service"), /HTTP/);
});

test("exposes reads, gates writes, and always hides destructive tools", () => {
  const read = { name: "testops_find_testcases", inputSchema: { type: "object" } };
  const write = { name: "testops_create_testcase", inputSchema: { type: "object", properties: {} } };
  const destructive = { name: "testops_delete_testcases", inputSchema: { type: "object" } };
  assert.equal(exposeTool(read, false), read);
  assert.equal(exposeTool(write, false), null);
  assert.equal(exposeTool(destructive, true), null);
  const exposedWrite = exposeTool(write, true);
  assert.deepEqual(exposedWrite.inputSchema.properties.confirmed, {
    type: "boolean",
    const: true,
    description: "Must be true only after the user explicitly approves this exact external change."
  });
  assert.deepEqual(exposedWrite.inputSchema.required, ["confirmed"]);
});

test("strips local confirmation before forwarding an approved write", () => {
  assert.deepEqual(
    prepareCall("testops_create_testcase", { confirmed: true, projectId: 7 }, true),
    { name: "testops_create_testcase", arguments: { projectId: 7 } }
  );
  assert.throws(() => prepareCall("testops_create_testcase", { projectId: 7 }, true), /confirmed/);
  assert.throws(() => prepareCall("testops_delete_testcases", { confirmed: true }, true), /Destructive/);
});
