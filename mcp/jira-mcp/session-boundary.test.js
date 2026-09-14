const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { Client } = require("@modelcontextprotocol/sdk/client/index.js");
const { StdioClientTransport } = require("@modelcontextprotocol/sdk/client/stdio.js");

test("real MCP transport gates opt-in and enforces session provenance, including after restart", { timeout: 20000 }, async (t) => {
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
  async function connect(enabled) {
    const env = {
      PATH: process.env.PATH,
      JIRA_URL: "https://jira.example.invalid", JIRA_AUTH_MODE: "basic",
      JIRA_EMAIL: "tester", JIRA_TOKEN: "test-only",
      TESTDOCS_TMS_PROVIDER: "zephyr_scale", TESTDOCS_ENABLE_TEST_CASE_CREATION: enabled ? "1" : "0"
    };
    const client = new Client({ name: "session-boundary-test", version: "1" });
    await client.connect(new StdioClientTransport({ command: process.execPath, args: ["--require", preload, path.join(__dirname, "mcp-stdio.js")], cwd: root, env, stderr: "pipe" }));
    t.after(() => client.close());
    return client;
  }
  const disabled = await connect(false);
  const readTools = (await disabled.listTools()).tools.map(({ name }) => name);
  assert(!readTools.includes("zephyr_create_test_case"));
  assert(!readTools.includes("zephyr_update_session_test_case"));
  assert(!readTools.includes("zephyr_update_test_case"));
  await disabled.close();

  const first = await connect(true);
  const enabledTools = (await first.listTools()).tools.map(({ name }) => name);
  assert(enabledTools.includes("zephyr_create_test_case"));
  assert(enabledTools.includes("zephyr_update_session_test_case"));
  assert(!enabledTools.includes("zephyr_update_test_case"));
  const update = (client, key) => client.callTool({ name: "zephyr_update_session_test_case", arguments: { confirmed: true, testCaseKey: key, name: "Corrected" } });
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
