const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { Client } = require("@modelcontextprotocol/sdk/client/index.js");
const { StdioClientTransport } = require("@modelcontextprotocol/sdk/client/stdio.js");

test("real MCP transport creates and corrects new cases without opt-in, rejecting old keys and restarted sessions", { timeout: 20000 }, async (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "testdocs-mcp-session-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const calls = path.join(root, "calls.jsonl");
  const preload = path.join(root, "mock-fetch.cjs");
  fs.writeFileSync(preload, `
const fs = require("node:fs");
global.fetch = async (url, options = {}) => {
  if (!String(url).startsWith("https://jira.example.invalid/")) throw new Error("Unexpected test URL");
  fs.appendFileSync(${JSON.stringify(calls)}, JSON.stringify({ url: String(url), method: options.method, body: options.body }) + "\\n");
  return { ok: true, status: 200, headers: { get: () => "application/json" }, text: async () => JSON.stringify({ key: "DEMO-T2" }) };
};
`);
  async function connect(enabled, provider = "zephyr_scale") {
    const env = {
      PATH: process.env.PATH,
      JIRA_URL: "https://jira.example.invalid", JIRA_AUTH_MODE: "basic",
      JIRA_EMAIL: "tester", JIRA_TOKEN: "test-only",
      TESTDOCS_TMS_PROVIDER: provider, TESTDOCS_ENABLE_WRITES: "0",
      TESTDOCS_ENABLE_TEST_CASE_CREATION: enabled ? "1" : "0"
    };
    const client = new Client({ name: "session-boundary-test", version: "1" });
    await client.connect(new StdioClientTransport({ command: process.execPath, args: ["--require", preload, path.join(__dirname, "mcp-stdio.js")], cwd: root, env, stderr: "pipe" }));
    t.after(() => client.close());
    return client;
  }
  const defaultClient = await connect(false);
  const defaultTools = (await defaultClient.listTools()).tools.map(({ name }) => name);
  assert(defaultTools.includes("zephyr_create_test_case"));
  assert(defaultTools.includes("zephyr_update_session_test_case"));
  assert(!defaultTools.includes("zephyr_update_test_case"));
  assert(!defaultTools.includes("add_comment") && !defaultTools.includes("transition_issue"));
  const createInput = {
    confirmed: true, projectKey: "DEMO", folder: "/", name: "Profile",
    steps: [{ description: "Save name", expectedResult: "Name saved" }]
  };
  assert.equal((await defaultClient.callTool({ name: "zephyr_create_test_case", arguments: { ...createInput, confirmed: false } })).isError, true);
  assert(!fs.existsSync(calls), "Unconfirmed creation reached network");
  const update = (client, key, confirmed = true) => client.callTool({ name: "zephyr_update_session_test_case", arguments: { confirmed, testCaseKey: key, name: "Corrected" } });
  assert.equal((await update(defaultClient, "DEMO-T1")).isError, true);
  assert(!fs.existsSync(calls), "Existing case reached network");
  assert(!(await defaultClient.callTool({ name: "zephyr_create_test_case", arguments: createInput })).isError);
  assert.equal((await update(defaultClient, "DEMO-T2", false)).isError, true);
  assert(!(await update(defaultClient, "DEMO-T2")).isError);
  assert.deepEqual(fs.readFileSync(calls, "utf8").trim().split("\n").map((line) => JSON.parse(line).method), ["POST", "PUT"]);
  await defaultClient.close();
  fs.unlinkSync(calls);

  const otherTms = await connect(true, "none");
  const otherTools = (await otherTms.listTools()).tools.map(({ name }) => name);
  assert(!otherTools.includes("zephyr_create_test_case") && !otherTools.includes("zephyr_update_session_test_case"));
  await otherTms.close();

  const first = await connect(true);
  const enabledTools = (await first.listTools()).tools.map(({ name }) => name);
  assert(enabledTools.includes("zephyr_create_test_case"));
  assert(enabledTools.includes("zephyr_update_session_test_case"));
  assert(!enabledTools.includes("zephyr_update_test_case"));
  assert.equal((await update(first, "DEMO-T1")).isError, true);
  assert(!fs.existsSync(calls), "Unknown session key reached network");
  const created = await first.callTool({ name: "zephyr_create_test_case", arguments: {
    confirmed: true, projectKey: "DEMO", folder: "/", name: "Profile",
    steps: [{ description: "Save name", expectedResult: "Name saved" }]
  } });
  assert(!created.isError, JSON.stringify(created));
  assert(!((await update(first, "DEMO-T2")).isError));
  assert.deepEqual(fs.readFileSync(calls, "utf8").trim().split("\n").map((line) => JSON.parse(line).method), ["POST", "PUT"]);
  await first.close();
  const restarted = await connect(true);
  assert.equal((await update(restarted, "DEMO-T2")).isError, true);
  assert.equal(fs.readFileSync(calls, "utf8").trim().split("\n").length, 2, "Restart restored eligibility incorrectly");
});
