const test = require("node:test");
const assert = require("node:assert/strict");
const { EVA_TOOLS, apiUrl, callEvaTool } = require("./eva-api");

test("Eva adapter contains only read tools", () => {
  assert(EVA_TOOLS.some((tool) => tool.name === "eva_task_get"));
  assert(EVA_TOOLS.some((tool) => tool.name === "eva_document_get"));
  assert(EVA_TOOLS.every((tool) => !/(?:create|update|delete|archive)/.test(tool.name)));
  assert(EVA_TOOLS.every((tool) => tool.annotations.readOnlyHint === true));
});

test("Eva API URL preserves an instance subpath", () => {
  assert.equal(apiUrl("https://eva.example/team", "CmfTask.get").href, "https://eva.example/team/api/?m=CmfTask.get");
});

test("Eva task read sends a token only in Authorization and uses JSON-RPC 2.2", async () => {
  let request;
  const result = await callEvaTool("eva_task_get", { code: "DEMO-42" }, {
    baseUrl: "https://eva.example/team",
    token: "top-secret"
  }, async (url, options) => {
    request = { url: String(url), options };
    return { ok: true, status: 200, text: async () => JSON.stringify({ result: { code: "DEMO-42" } }) };
  });
  assert.deepEqual(result, { code: "DEMO-42" });
  assert.equal(request.options.headers.Authorization, "Bearer top-secret");
  assert(!request.url.includes("top-secret"));
  const body = JSON.parse(request.options.body);
  assert.equal(body.jsonrpc, "2.2");
  assert.equal(body.method, "CmfTask.get");
  assert.deepEqual(body.kwargs.filter, ["code", "==", "DEMO-42"]);
  assert(!request.options.body.includes("top-secret"));
});

test("Eva task comments use the task parent ID convention", async () => {
  let body;
  await callEvaTool("eva_comment_list", { task_code: "DEMO-42", limit: 10 }, {
    baseUrl: "https://eva.example",
    token: "token"
  }, async (_url, options) => {
    body = JSON.parse(options.body);
    return { ok: true, status: 200, text: async () => JSON.stringify({ result: [] }) };
  });
  assert.deepEqual(body.kwargs.filter, ["parent_id", "==", "Task:DEMO-42"]);
  assert.deepEqual(body.kwargs.slice, [0, 10]);
});
