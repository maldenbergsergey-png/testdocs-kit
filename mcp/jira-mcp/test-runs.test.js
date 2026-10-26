const test = require("node:test");
const assert = require("node:assert/strict");
const { createTestRunTools } = require("./test-runs");

// Model the two APIs' different identity spaces and the UI endpoint's insert-at-front behavior.
function fixture() {
  const state = {
    run: { key: "DEMO-R7", projectKey: "DEMO", name: "Release", plannedStartDate: "2026-10-26T10:00:00.000Z", plannedEndDate: "2026-10-27T10:00:00.000Z" },
    identity: { id: 7, projectId: 9, folderId: 4 },
    items: [1, 2, 3].map((number, index) => ({ id: number * 10, index, $lastTestResult: { id: number * 100, testCase: { key: `DEMO-T${number}`, id: number }, status: number === 1 ? "Pass" : "Not Executed", comment: number === 1 ? "Evidence preserved" : "", assignedTo: "qa" } }))
  };
  const calls = [];
  let fail;
  async function request(path, method = "GET", body) {
    calls.push({ path, method, body: structuredClone(body) });
    if (fail) await fail(path, method, body, state, calls);
    if (path.includes("foldertree/testrun")) return [{ id: 4, name: "Release", children: [{ id: 5, name: "Archive" }] }];
    if (path.includes("/testresults/page")) return { total: 3, values: structuredClone(state.items.map((item) => item.$lastTestResult)) };
    if (path.includes("/testrun/search?")) return [structuredClone(state.run)];
    if (path.includes("/testrun/DEMO-R7?")) {
      if (!state.run) throw Object.assign(new Error("Not found"), { status: 404 });
      return structuredClone({ ...state.run, ...state.identity });
    }
    if (path.endsWith("/testrun/7/testrunitems")) return { testRunItems: structuredClone(state.items) };
    if (/\/testcase\/DEMO-T\d+\?/.test(path)) return { id: Number(path.match(/DEMO-T(\d+)/)[1]), key: path.match(/DEMO-T\d+/)[0] };
    if (path.endsWith("/testrun/7") && method === "PUT") { Object.assign(state.identity, body); Object.assign(state.run, Object.fromEntries(Object.entries(body).filter(([key]) => !["id", "projectId", "folderId"].includes(key)))); return {}; }
    if (path.endsWith("/testrunitem/bulk/save") && method === "PUT") {
      for (const change of body.updatedTestRunItemsIndexes) state.items.find((item) => item.id === change.id).index = change.index;
      state.items = state.items.filter((item) => !body.deletedTestRunItems.some((deleted) => deleted.id === item.id));
      for (const item of body.addedTestRunItems) {
        const number = item.lastTestResult.testCaseId;
        state.items.push({ id: number * 10, index: item.index, $lastTestResult: { id: number * 100, testCase: { key: `DEMO-T${number}`, id: number }, status: "Not Executed", comment: "", assignedTo: item.lastTestResult.assignedTo } });
      }
      state.items.sort((a, b) => a.index - b.index);
      return {};
    }
    if (path.endsWith("/testresult") && method === "PUT") { const key = path.match(/testcase\/(DEMO-T\d+)/)[1]; Object.assign(state.items.find((item) => item.$lastTestResult.testCase.key === key).$lastTestResult, body); return {}; }
    if (path.endsWith("/testrun/DEMO-R7") && method === "DELETE") { state.run = null; return {}; }
    throw new Error(`Unexpected ${method} ${path}`);
  }
  const getRun = async () => {
    if (!state.run) throw Object.assign(new Error("Not found"), { status: 404 });
    return { ...structuredClone(state.run), items: structuredClone(state.items.map((item) => ({ ...item.$lastTestResult, testCaseKey: item.$lastTestResult.testCase.key }))) };
  };
  const tools = createTestRunTools({ request, getRun, jiraRequest: async () => ({ id: "9" }), webUrl: (key) => `https://jira.example.test/run/${key}`, managementEnabled: () => true });
  const input = async () => ({ confirmed: true, testRunKey: "DEMO-R7", expectedContentHash: (await tools.zephyr_get_test_run_items({ testRunKey: "DEMO-R7" }))._testdocs.contentHash });
  const writes = () => calls.filter((call) => call.method !== "GET");
  return { state, tools, input, writes, calls, setFail: (fn) => { fail = fn; } };
}

test("management snapshot exposes stable run item IDs separately from execution IDs and a current hash", async () => {
  const f = fixture();
  const snapshot = await f.tools.zephyr_get_test_run_items({ testRunKey: "DEMO-R7" });
  assert.equal(snapshot.items[0].id, 10);
  assert.equal(snapshot.run.items[0].id, 100);
  assert.match(snapshot._testdocs.contentHash, /^[a-f0-9]{64}$/);
  assert.equal(snapshot._testdocs.readOnly, true);
});

test("disabled, unconfirmed, stale, foreign and duplicate removals never write", async () => {
  const f = fixture();
  const initial = await f.input();
  for (const input of [{ ...initial, confirmed: false, itemIds: [10] }, { ...initial, itemIds: [100] }, { ...initial, itemIds: [10, 10] }]) {
    await assert.rejects(f.tools.zephyr_remove_test_run_items(input));
  }
  f.state.items[0].$lastTestResult.comment = "Concurrent evidence";
  await assert.rejects(f.tools.zephyr_remove_test_run_items({ ...initial, itemIds: [10] }), /CONFLICT/);
  assert.equal(f.writes().length, 0);
  const disabled = createTestRunTools({ managementEnabled: () => false });
  await assert.rejects(disabled.zephyr_delete_test_run(initial), /disabled/);
});

test("remove deletes only the selected item, compacts order and preserves the other execution data", async () => {
  const f = fixture();
  const evidence = structuredClone(f.state.items[0]);
  const outcome = await f.tools.zephyr_remove_test_run_items({ ...await f.input(), itemIds: [20] });
  assert.equal(outcome.verificationStatus, "VERIFIED");
  assert.deepEqual(outcome.removedItemIds, [20]);
  assert.deepEqual(f.state.items.map((item) => [item.id, item.index]), [[10, 0], [30, 1]]);
  assert.deepEqual(f.state.items[0], evidence);
  assert.deepEqual(f.writes()[0].body.deletedTestRunItems, [{ id: 20 }]);
  assert(f.writes().every((call) => call.path.endsWith("/testrunitem/bulk/save")));
});

test("adding uses resolved test case IDs and batch indexes, then appends without changing old executions", async () => {
  const f = fixture();
  const old = structuredClone(f.state.items);
  const result = await f.tools.zephyr_add_test_run_items({ ...await f.input(), items: [{ testCaseKey: "DEMO-T4", userKey: "anna" }, { testCaseKey: "DEMO-T5", userKey: "ivan" }] });
  assert.equal(result.verificationStatus, "VERIFIED");
  assert.deepEqual(f.state.items.map((item) => item.$lastTestResult.testCase.key), ["DEMO-T1", "DEMO-T2", "DEMO-T3", "DEMO-T4", "DEMO-T5"]);
  assert.deepEqual(f.state.items.slice(0, 3), old);
  assert.deepEqual(f.writes()[0].body.addedTestRunItems.map((item) => item.index), [0, 1]);
  assert.equal(f.writes()[0].body.addedTestRunItems[0].lastTestResult.assignedTo, "anna");
  assert.equal(f.writes().length, 2);
});

test("duplicate and existing additions, unsupported payload fields and unknown IDs fail before mutation", async () => {
  const f = fixture();
  const guard = await f.input();
  for (const items of [[{ testCaseKey: "DEMO-T1", userKey: "qa" }], [{ testCaseKey: "DEMO-T4", userKey: "qa" }, { testCaseKey: "DEMO-T4", userKey: "qa" }], [{ testCaseKey: "DEMO-T4", userKey: "qa", status: "Pass" }]]) {
    await assert.rejects(f.tools.zephyr_add_test_run_items({ ...guard, items }));
  }
  await assert.rejects(f.tools.zephyr_update_test_run({ ...guard, status: "Pass" }), /Unsupported/);
  await assert.rejects(f.tools.zephyr_reorder_test_run_items({ ...guard, itemIds: [10, 20] }), /every/);
  assert.equal(f.writes().length, 0);
});

test("interrupted append reports the same run and accepted additions without repeating the write", async () => {
  const f = fixture();
  f.setFail((path, method, body, state, calls) => {
    if (method === "PUT" && calls.filter((call) => call.method === "PUT").length === 2) throw new Error("connection interrupted");
  });
  const outcome = await f.tools.zephyr_add_test_run_items({ ...await f.input(), items: [{ testCaseKey: "DEMO-T4", userKey: "qa" }] });
  assert.equal(outcome.testRunKey, "DEMO-R7");
  assert.equal(outcome.mutationOutcome, "ACCEPTED");
  assert.equal(outcome.verificationStatus, "UNAVAILABLE");
  assert.equal(outcome.phase, "APPEND_ORDER");
  assert.equal(f.state.items.length, 4);
  assert.equal(f.writes().length, 2);
});

test("an uncertain first write is never retried or described as a successful change", async () => {
  const f = fixture();
  f.setFail((path, method) => { if (method === "PUT") throw new Error("timeout"); });
  const result = await f.tools.zephyr_remove_test_run_items({ ...await f.input(), itemIds: [20] });
  assert.equal(result.changed, null);
  assert.equal(result.mutationOutcome, "UNKNOWN");
  assert.equal(result.verificationStatus, "UNAVAILABLE");
  assert.equal(f.writes().length, 1);
});

test("a concurrent retained-item reorder after addition stops the follow-up order write", async () => {
  const f = fixture();
  let reordered = false;
  f.setFail((path, method, body, state) => {
    if (path.endsWith("/testrunitems") && f.writes().length === 1 && !reordered) {
      reordered = true;
      state.items.find((item) => item.id === 10).index = 2;
      state.items.find((item) => item.id === 20).index = 1;
    }
  });
  const result = await f.tools.zephyr_add_test_run_items({ ...await f.input(), items: [{ testCaseKey: "DEMO-T4", userKey: "qa" }] });
  assert.equal(result.verificationStatus, "UNAVAILABLE");
  assert.equal(result.mutationOutcome, "ACCEPTED");
  assert.equal(result.phase, "VERIFY_ADDITION");
  assert.equal(f.writes().length, 1);
});

test("reorder uses all stable IDs, handles duplicate case configurations, and skips correct order", async () => {
  const f = fixture();
  assert.equal((await f.tools.zephyr_reorder_test_run_items({ ...await f.input(), itemIds: [10, 20, 30] })).changed, false);
  f.state.items[1].$lastTestResult.testCase = { id: 1, key: "DEMO-T1" };
  const result = await f.tools.zephyr_reorder_test_run_items({ ...await f.input(), itemIds: [30, 20, 10] });
  assert.equal(result.verificationStatus, "VERIFIED");
  assert.deepEqual(f.state.items.map((item) => item.id), [30, 20, 10]);
  await assert.rejects(f.tools.zephyr_update_test_run_result({ ...await f.input(), testCaseKey: "DEMO-T1", status: "Pass" }), /ambiguous/);
});

test("header updates send only requested fields, normalize dates and validate the run folder type/project", async () => {
  const f = fixture();
  const result = await f.tools.zephyr_update_test_run({ ...await f.input(), name: "Hotfix", folderId: 5, plannedEndDate: "2026-10-28T13:00:00+03:00" });
  assert.equal(result.verificationStatus, "VERIFIED");
  assert.deepEqual(f.writes()[0].body, { id: 7, projectId: 9, name: "Hotfix", folderId: 5, plannedEndDate: "2026-10-28T10:00:00.000Z" });
  assert.equal(f.state.items[0].$lastTestResult.comment, "Evidence preserved");
  await assert.rejects(f.tools.zephyr_update_test_run({ ...await f.input(), folderId: 777 }), /TEST_RUN/);
  await assert.rejects(f.tools.zephyr_update_test_run({ ...await f.input(), plannedStartDate: "2026-11-01T10:00:00Z" }), /must not follow/);
  await assert.rejects(f.tools.zephyr_update_test_run({ ...await f.input(), plannedStartDate: "2026-11-01T10:00:00" }), /timezone/);
  assert.equal(f.writes().length, 1);
});

test("ignored header writes and unexpected retained result changes fail verification", async () => {
  const f = fixture();
  f.setFail((path, method, body, state) => { if (method === "PUT" && path.endsWith("/testrun/7")) body.name = "Truncated"; });
  const outcome = await f.tools.zephyr_update_test_run({ ...await f.input(), name: "Release renamed" });
  assert.equal(outcome.verificationStatus, "FAILED");
  const g = fixture();
  g.setFail((path, method, body, state) => { if (method === "PUT") state.items[0].$lastTestResult.status = "Fail"; });
  const removed = await g.tools.zephyr_remove_test_run_items({ ...await g.input(), itemIds: [20] });
  assert.equal(removed.verificationStatus, "UNAVAILABLE");
  assert.equal(g.writes().length, 1);
});

test("latest result update sends a public PUT, preserves unrelated execution data and never creates a result", async () => {
  const f = fixture();
  const result = await f.tools.zephyr_update_test_run_result({ ...await f.input(), testCaseKey: "DEMO-T2", status: "Fail", comment: "Actual failure" });
  assert.equal(result.verificationStatus, "VERIFIED");
  assert.deepEqual(f.writes().map((call) => [call.method, call.body]), [["PUT", { status: "Fail", comment: "Actual failure" }]]);
  assert(f.writes()[0].path.startsWith("/rest/atm/1.0/"));
  assert.equal(f.state.items[0].$lastTestResult.comment, "Evidence preserved");
});

test("assignment-only updates cannot hide a reset of the same execution's status or evidence", async () => {
  const f = fixture();
  f.setFail((path, method, body, state) => { if (path.endsWith("/testresult") && method === "PUT") state.items[0].$lastTestResult.status = "Not Executed"; });
  const result = await f.tools.zephyr_update_test_run_result({ ...await f.input(), testCaseKey: "DEMO-T1", assignedTo: "anna" });
  assert.equal(result.verificationStatus, "FAILED");
  assert(result.mismatches.some((message) => message.includes("status")));
});

test("explicit deletion verifies absence and does not touch cases or Jira work items", async () => {
  const f = fixture();
  const result = await f.tools.zephyr_delete_test_run(await f.input());
  assert.equal(result.deleted, true);
  assert.equal(result.verificationStatus, "VERIFIED");
  assert.deepEqual(f.writes().map((call) => [call.method, call.path]), [["DELETE", "/rest/atm/1.0/testrun/DEMO-R7"]]);
  assert.equal(f.state.items.length, 3);
});

test("incomplete or incompatible internal inventories never authorize deletion", async () => {
  const f = fixture();
  const guard = await f.input();
  f.setFail((path, method, body, state) => { if (path.endsWith("/testrunitems")) delete state.items[0].$lastTestResult; });
  await assert.rejects(f.tools.zephyr_delete_test_run(guard), /Unsupported/);
  assert.equal(f.writes().length, 0);
});

test("public search/result paging stays read-only and filters are encoded", async () => {
  const f = fixture();
  const page = await f.tools.zephyr_search_test_runs({ projectKey: "DEMO", folder: '/Release/"Q"', maxResults: 1 });
  assert.equal(page.nextStartAt, 1);
  assert.equal(new URL(f.calls[0].path, "https://jira.test").searchParams.get("query"), 'projectKey = "DEMO" AND folder = "/Release/\\"Q\\""');
  const results = await f.tools.zephyr_get_test_run_results({ testRunKey: "DEMO-R7", onlyLastExecutions: true });
  assert.equal(results.total, 3);
  assert.equal(f.writes().length, 0);
});

test("older result APIs paginate locally and select latest execution IDs, with no fallback on permission errors", async () => {
  const calls = [];
  let status = 404;
  const tools = createTestRunTools({
    request: async (path) => {
      calls.push(path);
      if (path.includes("/page")) throw Object.assign(new Error("unavailable"), { status });
      return [{ id: 100, status: "Fail" }, { id: 200, status: "Pass" }, { id: 300, status: "Pass" }];
    },
    getRun: async () => ({ items: [{ id: 200 }, { id: 300 }] })
  });
  const result = await tools.zephyr_get_test_run_results({ testRunKey: "DEMO-R7", maxResults: 1, startAt: 1, onlyLastExecutions: true });
  assert.deepEqual(result.values, [{ id: 300, status: "Pass" }]);
  assert.equal(result.total, 2);
  assert.equal(result._testdocs.legacyFallback, true);
  status = 403;
  const before = calls.length;
  await assert.rejects(tools.zephyr_get_test_run_results({ testRunKey: "DEMO-R7" }), /unavailable/);
  assert.equal(calls.length, before + 1);
});
