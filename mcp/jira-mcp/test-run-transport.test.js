const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { Client } = require("@modelcontextprotocol/sdk/client/index.js");
const { StdioClientTransport } = require("@modelcontextprotocol/sdk/client/stdio.js");
const { managementTools } = require("./test-runs");

test("MCP management opt-in is separate from creation, provider-scoped, guarded and executable", { timeout: 20000 }, async (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "testdocs-run-mcp-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const calls = path.join(root, "calls.jsonl");
  const preload = path.join(root, "fetch.cjs");
  fs.writeFileSync(preload, `
const fs = require('node:fs');
let exists = true;
let items = [1,2].map((n,index)=>({id:n*10,index,$lastTestResult:{id:n*100,testCase:{id:n,key:'DEMO-T'+n},assignedTo:'qa',status:n===1?'Pass':'Not Executed',comment:'evidence-'+n}}));
global.fetch = async (url, options={}) => {
  const u = new URL(url);
  if (u.origin !== 'https://jira.example.invalid') throw new Error('Unexpected host');
  const method = options.method || 'GET';
  const body = options.body ? JSON.parse(options.body) : undefined;
  fs.appendFileSync(${JSON.stringify(calls)}, JSON.stringify({path:u.pathname,method,body})+'\\n');
  let data;
  let status=200;
  if(u.pathname==='/rest/atm/1.0/testrun/DEMO-R7') {
    if(method==='DELETE') {exists=false;status=204;}
    else if(!exists) {status=404;data={error:'not found'};}
    else data={key:'DEMO-R7',projectKey:'DEMO',name:'Release',items:items.map(x=>({...x.$lastTestResult,testCaseKey:x.$lastTestResult.testCase.key}))};
  } else if(u.pathname==='/rest/tests/1.0/testrun/DEMO-R7') data={id:7,projectId:9,key:'DEMO-R7',name:'Release'};
  else if(u.pathname==='/rest/tests/1.0/testrun/7/testrunitems') data={testRunItems:items};
  else if(u.pathname==='/rest/tests/1.0/testrunitem/bulk/save' && method==='PUT') {
    items=items.filter(x=>!body.deletedTestRunItems.some(d=>d.id===x.id));
    body.updatedTestRunItemsIndexes.forEach(change=>{items.find(x=>x.id===change.id).index=change.index;});data={};
  } else throw new Error('Unexpected '+method+' '+u.pathname);
  return {ok:status<300,status,statusText:'mock',headers:{get:()=> 'application/json'},text:async()=>status===204?'':JSON.stringify(data)};
};
`);
  async function connect(management, creation = false, provider = "zephyr_scale") {
    const client = new Client({ name: "run-management-test", version: "1" });
    await client.connect(new StdioClientTransport({ command: process.execPath, args: ["--require", preload, path.join(__dirname, "mcp-stdio.js")], cwd: root, stderr: "pipe", env: {
      PATH: process.env.PATH, JIRA_URL: "https://jira.example.invalid", JIRA_AUTH_MODE: "basic", JIRA_EMAIL: "tester", JIRA_TOKEN: "fixture-only",
      TESTDOCS_TMS_PROVIDER: provider, TESTDOCS_ENABLE_WRITES: "0", TESTDOCS_ENABLE_RELEASE_TEST_RUN_CREATION: creation ? "1" : "0", TESTDOCS_ENABLE_TEST_RUN_MANAGEMENT: management ? "1" : "0"
    } }));
    t.after(() => client.close());
    return client;
  }
  const old = await connect(false, true);
  const oldNames = (await old.listTools()).tools.map((tool) => tool.name);
  assert(oldNames.includes("zephyr_create_test_run"));
  assert(oldNames.includes("zephyr_search_test_runs") && oldNames.includes("zephyr_get_test_run_results"));
  assert(!oldNames.some((name) => managementTools.includes(name)));
  const other = await connect(true, false, "none");
  assert(!(await other.listTools()).tools.some((tool) => tool.name.startsWith("zephyr_")));
  const client = await connect(true);
  const inventory = (await client.listTools()).tools;
  for (const name of managementTools) assert(inventory.some((tool) => tool.name === name), name);
  assert.equal(inventory.find((tool) => tool.name === "zephyr_remove_test_run_items").annotations.destructiveHint, true);
  assert.equal(inventory.find((tool) => tool.name === "zephyr_get_test_run_items").annotations.readOnlyHint, true);
  const call = (name, input) => client.callTool({ name, arguments: input });
  const decoded = (result) => { assert(!result.isError, JSON.stringify(result)); return JSON.parse(result.content[0].text); };
  const snapshot = decoded(await call("zephyr_get_test_run_items", { testRunKey: "DEMO-R7" }));
  const guard = { confirmed: true, testRunKey: "DEMO-R7", expectedContentHash: snapshot._testdocs.contentHash };
  assert((await call("zephyr_remove_test_run_items", { ...guard, itemIds: [20], confirmed: false })).isError);
  assert((await call("zephyr_remove_test_run_items", { ...guard, itemIds: [200] })).isError);
  assert((await call("zephyr_update_test_run", { ...guard, name: "Title", status: "Pass" })).isError, "Unsupported fields must not be silently discarded");
  assert((await call("zephyr_update_session_test_case", { confirmed: true, testCaseKey: "DEMO-T1", name: "Unauthorized source edit" })).isError);
  assert(!fs.readFileSync(calls, "utf8").includes('"method":"PUT"'));
  const removed = decoded(await call("zephyr_remove_test_run_items", { ...guard, itemIds: [20] }));
  assert.equal(removed.verificationStatus, "VERIFIED");
  const after = decoded(await call("zephyr_get_test_run_items", { testRunKey: "DEMO-R7" }));
  assert.equal(after.items.length, 1);
  assert.equal(after.run.items[0].comment, "evidence-1");
  assert((await call("zephyr_delete_test_run", guard)).isError, "Stale baseline must not delete");
  const deleted = decoded(await call("zephyr_delete_test_run", { ...guard, expectedContentHash: after._testdocs.contentHash }));
  assert.equal(deleted.deleted, true);
  assert.equal(deleted.verificationStatus, "VERIFIED");
  const writes = fs.readFileSync(calls, "utf8").trim().split("\n").map(JSON.parse).filter((entry) => entry.method !== "GET");
  assert.deepEqual(writes.map((entry) => entry.method), ["PUT", "DELETE"]);
  assert.deepEqual(writes[0].body.deletedTestRunItems, [{ id: 20 }]);
});
