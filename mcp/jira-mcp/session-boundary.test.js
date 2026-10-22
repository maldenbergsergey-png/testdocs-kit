const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { Client } = require("@modelcontextprotocol/sdk/client/index.js");
const { StdioClientTransport } = require("@modelcontextprotocol/sdk/client/stdio.js");

test("real MCP transport uploads a source image and reads back a thumbnail in the selected step cell", { timeout: 20000 }, async (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "testdocs-mcp-step-image-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a7WQAAAAASUVORK5CYII=", "base64");
  const imagePath = path.join(root, "profile.png");
  const calls = path.join(root, "calls.jsonl");
  const preload = path.join(root, "mock-fetch.cjs");
  fs.writeFileSync(imagePath, png);
  fs.writeFileSync(preload, `
const fs = require("node:fs");
let attachments = [];
let script = { type: "STEP_BY_STEP", steps: [{index:0,description:"Open profile",expectedResult:"Form opened"},{index:1,description:"Save empty name",expectedResult:"Name required"}] };
global.fetch = async (url, options = {}) => {
  url = String(url);
  if (!url.startsWith("https://jira.example.invalid/")) throw new Error("Unexpected test URL");
  const method = options.method || "GET";
  let data;
  const log = { url, method };
  if (/\\/step\\/\\d+\\/attachments$/.test(url)) data = [];
  else if (url.endsWith("/testcase/DEMO-T2/attachments")) {
    if (method === "POST") {
      if (options.headers["Content-Type"]) throw new Error("Multipart boundary overridden");
      const file = options.body.get("file");
      log.bytes = Buffer.from(await file.arrayBuffer()).toString("base64");
      attachments = [{ id: 123, filename: file.name, filesize: file.size, url: "https://jira.example.invalid/attachment/123" }];
      data = { id: "123" };
    } else data = attachments;
  } else if (url.endsWith("/testcase") && method === "POST") data = { key: "DEMO-T2" };
  else if (url.endsWith("/testcase/DEMO-T2") && method === "PUT") { script = JSON.parse(options.body).testScript; data = {}; }
  else if (url.endsWith("/testcase/DEMO-T2") && method === "GET") data = {key:"DEMO-T2",testScript:script};
  else throw new Error("Unexpected step or endpoint: " + url);
  fs.appendFileSync(${JSON.stringify(calls)}, JSON.stringify(log) + "\\n");
  return { ok: true, status: method === "POST" ? 201 : 200, headers: { get: () => "application/json" }, text: async () => JSON.stringify(data) };
};
`);
  const client = new Client({ name: "step-image-test", version: "1" });
  await client.connect(new StdioClientTransport({ command: process.execPath, args: ["--require", preload, path.join(__dirname, "mcp-stdio.js")], cwd: root, env: {
    PATH: process.env.PATH, JIRA_URL: "https://jira.example.invalid", JIRA_AUTH_MODE: "basic", JIRA_EMAIL: "tester", JIRA_TOKEN: "test-only",
    TESTDOCS_TMS_PROVIDER: "zephyr_scale", TESTDOCS_ENABLE_WRITES: "0"
  }, stderr: "pipe" }));
  t.after(() => client.close());
  const invoke = (name, args) => client.callTool({ name, arguments: args });
  const image = { confirmed: true, testCaseKey: "DEMO-T2", stepIndex: 1, imagePath, expectedContentHash: "unknown", targetField: "expectedResult", caption: "Макет - ошибка имени" };
  assert.equal((await invoke("zephyr_add_session_step_image", image)).isError, true);
  assert(!fs.existsSync(calls), "Unknown key reached network");
  assert(!(await invoke("zephyr_create_test_case", { confirmed: true, projectKey: "DEMO", folder: "/", name: "Profile", steps: [
    { description: "Open profile", expectedResult: "Form opened" }, { description: "Save empty name", expectedResult: "Name required" }
  ] })).isError);
  const baseline = JSON.parse((await invoke("zephyr_get_test_case", { testCaseKey: "DEMO-T2" })).content[0].text);
  image.expectedContentHash = baseline._testdocs.contentHash;
  assert.equal((await invoke("zephyr_add_session_step_image", { ...image, confirmed: false })).isError, true);
  const result = await invoke("zephyr_add_session_step_image", image);
  assert(!result.isError, JSON.stringify(result));
  const outcome = JSON.parse(result.content[0].text);
  assert.equal(outcome.status, "preview_saved");
  assert.equal(outcome.stepIndex, 1);
  assert.equal(outcome.url, "https://jira.example.invalid/attachment/123");
  assert.equal(outcome.displayVerified, false);
  const entries = JSON.parse((await invoke("zephyr_get_test_case_attachments", { testCaseKey: "DEMO-T2" })).content[0].text);
  assert.equal(entries[0].id, 123);
  const uploads = fs.readFileSync(calls, "utf8").trim().split("\n").map((line) => JSON.parse(line)).filter((entry) => entry.bytes);
  assert.equal(uploads.length, 1);
  assert.equal(uploads[0].bytes, png.toString("base64"));
});

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
  assert.match(defaultClient.getInstructions(), /HTTP 403 alone does not establish missing project permissions/);
  const inventory = (await defaultClient.listTools()).tools;
  const defaultTools = inventory.map(({ name }) => name);
  assert.equal(inventory.find(({ name }) => name === "jira_get_connection_diagnostics").annotations.readOnlyHint, true);
  const localDiagnostics = await defaultClient.callTool({ name: "jira_get_connection_diagnostics", arguments: {} });
  assert.notEqual(localDiagnostics.isError, true);
  const diagnostics = JSON.parse(localDiagnostics.content[0].text);
  assert.equal(diagnostics.networkRequestPerformed, false);
  assert.equal(diagnostics.connection.gatewayHeader.configured, false);
  assert.equal(diagnostics.lastHttpError, null);
  assert(!fs.existsSync(calls), "Local diagnostics reached the network");
  assert(defaultTools.includes("zephyr_create_test_case"));
  assert(defaultTools.includes("zephyr_update_session_test_case"));
  assert(defaultTools.includes("zephyr_add_session_step_image"));
  assert(defaultTools.includes("zephyr_get_test_case_attachments"));
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
  const image = (client, key) => client.callTool({ name: "zephyr_add_session_step_image", arguments: {
    confirmed: true, testCaseKey: key, stepIndex: 0, expectedContentHash: "hash", imagePath: "/missing.png", targetField: "expectedResult", caption: "Макет"
  } });
  assert.equal((await image(defaultClient, "DEMO-T1")).isError, true);
  assert(!fs.existsSync(calls), "Old-case image request reached network");
  assert(!(await defaultClient.callTool({ name: "zephyr_create_test_case", arguments: createInput })).isError);
  assert.equal((await update(defaultClient, "DEMO-T2", false)).isError, true);
  assert(!(await update(defaultClient, "DEMO-T2")).isError);
  assert.deepEqual(fs.readFileSync(calls, "utf8").trim().split("\n").map((line) => JSON.parse(line).method), ["POST", "PUT"]);
  await defaultClient.close();
  fs.unlinkSync(calls);

  const otherTms = await connect(true, "none");
  const otherTools = (await otherTms.listTools()).tools.map(({ name }) => name);
  assert(otherTools.includes("jira_get_connection_diagnostics"));
  assert(!otherTools.includes("zephyr_create_test_case") && !otherTools.includes("zephyr_update_session_test_case"));
  assert(!otherTools.includes("zephyr_add_session_step_image") && !otherTools.includes("zephyr_get_test_case_attachments"));
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
  assert.equal((await image(restarted, "DEMO-T2")).isError, true);
  assert.equal(fs.readFileSync(calls, "utf8").trim().split("\n").length, 2, "Restart restored eligibility incorrectly");
});
