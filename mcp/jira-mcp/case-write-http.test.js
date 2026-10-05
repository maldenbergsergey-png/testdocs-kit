const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const net = require("node:net");
const { spawn } = require("node:child_process");
const { once } = require("node:events");

test("HTTP case writes need explicit intent and creation provenance, without setup opt-in", { timeout: 20000 }, async (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "testdocs-case-http-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const calls = path.join(root, "calls.jsonl");
  const preload = path.join(root, "mock-fetch.cjs");
  fs.writeFileSync(preload, `
const fs = require("node:fs");
global.fetch = async (url, options = {}) => {
  if (!String(url).startsWith("https://jira.example.invalid/")) throw new Error("Unexpected test URL");
  fs.appendFileSync(${JSON.stringify(calls)}, JSON.stringify({ method: options.method }) + "\\n");
  return { ok: true, status: 200, headers: { get: () => "application/json" }, text: async () => JSON.stringify({ key: "DEMO-T2" }) };
};
`);

  async function start(provider = "zephyr_scale") {
    const probe = net.createServer();
    probe.listen(0, "127.0.0.1");
    await once(probe, "listening");
    const port = probe.address().port;
    await new Promise((resolve, reject) => probe.close((error) => error ? reject(error) : resolve()));
    const child = spawn(process.execPath, ["--require", preload, path.join(__dirname, "server.js")], {
      cwd: root,
      env: {
        PATH: process.env.PATH, PORT: String(port),
        JIRA_URL: "https://jira.example.invalid", JIRA_AUTH_MODE: "basic",
        JIRA_EMAIL: "tester", JIRA_TOKEN: "test-only",
        TESTDOCS_TMS_PROVIDER: provider, TESTDOCS_ENABLE_WRITES: "0",
        TESTDOCS_ENABLE_TEST_CASE_CREATION: "0"
      },
      stdio: ["ignore", "pipe", "pipe"]
    });
    t.after(async () => {
      if (child.exitCode === null) {
        const exited = once(child, "exit");
        child.kill();
        await exited;
      }
    });
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("HTTP wrapper did not start")), 5000);
      child.on("error", (error) => { clearTimeout(timer); reject(error); });
      child.on("exit", (code) => { clearTimeout(timer); reject(new Error(`HTTP wrapper exited: ${code}`)); });
      child.stdout.on("data", (chunk) => {
        if (chunk.toString().includes("Jira HTTP wrapper is running")) { clearTimeout(timer); resolve(); }
      });
    });
    return async (tool, params) => {
      const response = await fetch(`http://127.0.0.1:${port}/mcp`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tool, params }), signal: AbortSignal.timeout(3000)
      });
      return { status: response.status, body: await response.json() };
    };
  }

  const call = await start();
  const create = {
    confirmed: true, projectKey: "DEMO", folder: "/", name: "Profile",
    steps: [{ description: "Save name", expectedResult: "Name saved" }]
  };
  assert.notEqual((await call("zephyr_create_test_case", { ...create, confirmed: false })).status, 200);
  assert.notEqual((await call("zephyr_update_session_test_case", { confirmed: true, testCaseKey: "DEMO-T1", name: "Changed" })).status, 200);
  assert(!fs.existsSync(calls), "Unconfirmed creation or an old-case update reached Jira");
  assert.equal((await call("zephyr_create_test_case", create)).body.result.key, "DEMO-T2");
  assert.notEqual((await call("zephyr_update_session_test_case", { confirmed: false, testCaseKey: "DEMO-T2", name: "Changed" })).status, 200);
  assert.equal((await call("zephyr_update_session_test_case", { confirmed: true, testCaseKey: "DEMO-T2", name: "Changed" })).status, 200);
  assert.equal((await call("zephyr_update_test_case", { testCaseKey: "DEMO-T1" })).status, 403);
  assert.equal((await call("add_comment", {})).status, 403);
  const otherProvider = await start("none");
  assert.equal((await otherProvider("zephyr_create_test_case", create)).status, 403);
  assert.deepEqual(fs.readFileSync(calls, "utf8").trim().split("\n").map((line) => JSON.parse(line).method), ["POST", "PUT"]);
});
