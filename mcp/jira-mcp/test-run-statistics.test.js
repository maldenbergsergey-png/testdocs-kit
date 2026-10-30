const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { createStatisticsTool, resolvePeriod, historyStatistics, recordedSummary, readAudit } = require("./test-run-statistics");

const NOW = Date.parse("2026-11-03T12:00:00Z");
const input = { testRunKey: "DEMO-R101", date: "2026-10-30", timeZone: "Europe/Moscow", historyMode: "public_records" };
const period = resolvePeriod(input, NOW);
const event = (id, testCaseKey, timestamp, fromStatus, toStatus, actor = "anna", extra = {}) => ({ id, executionId: testCaseKey, testCaseKey, timestamp, fromStatus, toStatus, actor, ...extra });
const history = (events, extra = {}) => ({ version: 1, instance: "https://jira.example.invalid", testRunKey: input.testRunKey, source: "Verified fixture audit export", complete: true, startInclusive: "2026-10-01T00:00:00Z", endExclusive: "2026-11-03T00:00:00Z", events, ...extra });
const aggregate = (events, p = period, statuses = ["Not Executed"]) => historyStatistics(history(events), input.testRunKey, p, statuses);
function fixture(request, options = {}) {
  const calls = [];
  const tool = createStatisticsTool({ request: async (url, ...args) => { calls.push(url); return request(url, ...args); }, getRun: async () => ({ key: input.testRunKey, name: "Regress" }), webUrl: () => "https://jira.example.invalid/run/101", now: () => NOW, ...options });
  return { tool, calls };
}

test("local calendar boundaries, inclusive periods, today and elapsed-day cutoff", () => {
  assert.equal(period.startInclusive, "2026-10-29T21:00:00.000Z");
  assert.equal(period.endExclusive, "2026-10-30T21:00:00.000Z");
  const today = resolvePeriod({ timeZone: "Europe/Moscow" }, Date.parse("2026-10-29T22:00:00Z"));
  assert.equal(today.startDate, "2026-10-30"); assert.equal(today.provisional, true);
  assert.equal(today.observedThrough, "2026-10-29T22:00:00.000Z");
  const range = resolvePeriod({ timeZone: "Europe/Moscow", startDate: "2026-10-29", endDate: "2026-10-30" }, NOW);
  assert.equal(range.startInclusive, "2026-10-28T21:00:00.000Z"); assert.equal(range.endExclusive, period.endExclusive);
});
test("DST days are 23/25 hours, and midnight offset changes use the first local instant", () => {
  for (const [date, hours] of [["2026-03-08", 23], ["2026-11-01", 25]]) {
    const p = resolvePeriod({ date, timeZone: "America/New_York" }, NOW);
    assert.equal((Date.parse(p.endExclusive) - Date.parse(p.startInclusive)) / 3600000, hours);
  }
  const p = resolvePeriod({ date: "2018-11-04", timeZone: "America/Sao_Paulo" }, NOW);
  assert.equal(p.startInclusive, "2018-11-04T03:00:00.000Z");
});
test("invalid dates, zones, mixed/incomplete ranges and future periods fail before HTTP", async () => {
  const f = fixture(() => { throw Error("must not call"); });
  for (const patch of [{ date: "2026-02-30" }, { timeZone: "wrong/zone" }, { timeZone: undefined }, { startDate: "2026-10-29" }, { date: undefined, startDate: "2026-10-31", endDate: "2026-10-30" }, { date: "2026-12-01" }, { assignedTo: "assignee" }, { includeRecordedSummary: "true" }, { historyMode: "guess" }]) await assert.rejects(f.tool({ ...input, ...patch }));
  assert.equal(f.calls.length, 0);
});
test("Not Executed → Failed → Passed counts once, with actual final actor and final status", () => {
  const result = aggregate([
    event("3", "DEMO-T1", "2026-10-30T14:00:00+0300", "Failed", "Passed", "boris"),
    event("1", "DEMO-T1", "2026-10-30T09:00:00+03:00", "Not Executed", "Failed", "anna"),
    event("2", "DEMO-T2", "2026-10-30T10:00:00+03:00", "Not Executed", "Custom Review", "anna")
  ]);
  assert.equal(result.quality, "HISTORY_BASED"); assert.equal(result.totals.total, 2);
  assert.deepEqual(result.rows.map((r) => [r.userKey, r.total]), [["anna", 1], ["boris", 1]]);
  assert.equal(result.rows[1].byStatus.Passed, 1); assert.equal(result.rows[1].byStatus["Custom Review"], 0);
});
test("boundaries, pre-existing executed cases and same-status edits do not inflate work", () => {
  const result = aggregate([
    event("0", "DEMO-T1", "2026-10-29T20:59:59Z", "Not Executed", "Failed"),
    event("1", "DEMO-T1", "2026-10-30T08:00:00Z", "Failed", "Passed"),
    event("2", "DEMO-T2", period.startInclusive, "Not Executed", "Blocked"),
    event("3", "DEMO-T2", "2026-10-30T08:00:00Z", "Blocked", "Blocked", "someone-else"),
    event("4", "DEMO-T3", period.endExclusive, "Not Executed", "Passed")
  ]);
  assert.equal(result.totals.total, 1); assert.equal(result.entries[0].testCaseKey, "DEMO-T2"); assert.equal(result.entries[0].userKey, "anna");
});
test("multiple configurations, repeated resets and duplicate exported events count one case/day", () => {
  const first = event("1", "DEMO-T1", "2026-10-30T08:00:00Z", "Not Executed", "Failed");
  const result = aggregate([first, { ...first },
    event("2", "DEMO-T1", "2026-10-30T09:00:00Z", "Not Executed", "Passed", "boris", { executionId: "other-config" }),
    event("3", "DEMO-T1", "2026-10-30T10:00:00Z", "Passed", "Not Executed", "resetter", { executionId: "other-config" }),
    event("4", "DEMO-T1", "2026-10-30T11:00:00Z", "Not Executed", "Blocked", "carol", { executionId: "other-config" })
  ]);
  assert.equal(result.totals.total, 1); assert.equal(result.entries[0].userKey, "carol"); assert.equal(result.entries[0].status, "Blocked");
});
test("range totals are case-days, final statuses are as of the range cutoff (including resets)", () => {
  const p = resolvePeriod({ timeZone: input.timeZone, startDate: "2026-10-29", endDate: "2026-10-30" }, NOW);
  const result = aggregate([
    event("1", "DEMO-T1", "2026-10-29T10:00:00Z", "Not Executed", "Failed"),
    event("2", "DEMO-T1", "2026-10-29T12:00:00Z", "Failed", "Not Executed"),
    event("3", "DEMO-T1", "2026-10-30T09:00:00Z", "Not Executed", "Passed", "boris"),
    event("4", "DEMO-T1", "2026-10-30T12:00:00Z", "Passed", "Not Executed", "resetter"),
    event("5", "DEMO-T1", "2026-10-31T08:00:00Z", "Not Executed", "Blocked", "carol")
  ], p);
  assert.equal(result.totals.total, 2); assert.equal(result.uniqueCases, 1);
  assert.deepEqual(result.entries.map((e) => [e.day, e.userKey, e.status]), [["2026-10-29", "anna", "Not Executed"], ["2026-10-30", "boris", "Not Executed"]]);
});
test("custom initial statuses are exact and unmapped names stay intact", () => {
  const result = aggregate([event("1", "DEMO-T1", "2026-10-30T10:00:00Z", "Не выполнен", "На проверке")], period, ["Не выполнен"]);
  assert.equal(result.totals.byStatus["На проверке"], 1);
});
test("all counted days use the whole period's final status while retaining each day's actor", () => {
  const p = resolvePeriod({ timeZone: input.timeZone, startDate: "2026-10-29", endDate: "2026-10-30" }, NOW);
  const result = aggregate([
    event("1", "DEMO-T1", "2026-10-29T10:00:00Z", "Not Executed", "Failed", "anna"),
    event("2", "DEMO-T1", "2026-10-29T12:00:00Z", "Failed", "Not Executed", "resetter"),
    event("3", "DEMO-T1", "2026-10-30T10:00:00Z", "Not Executed", "Passed", "boris")
  ], p);
  assert.equal(result.totals.byStatus.Passed, 2);
  assert.deepEqual(result.entries.map((e) => [e.day, e.userKey, e.status]), [["2026-10-29", "anna", "Passed"], ["2026-10-30", "boris", "Passed"]]);
});
test("missing actor, discontinuity and timestamp ties exclude affected cases instead of guessing", () => {
  for (const events of [
    [event("1", "DEMO-T1", "2026-10-30T10:00:00Z", "Not Executed", "Failed", null)],
    [event("1", "DEMO-T1", "2026-10-30T10:00:00Z", "Not Executed", "Failed"), event("2", "DEMO-T1", "2026-10-30T11:00:00Z", "Passed", "Blocked")],
    [event("1", "DEMO-T1", "2026-10-30T10:00:00Z", "Not Executed", "Failed"), event("2", "DEMO-T1", "2026-10-30T10:00:00Z", "Failed", "Passed", "boris")]
  ]) { const result = aggregate(events); assert.equal(result.quality, "PARTIAL_HISTORY"); assert.equal(result.totals.total, 0); assert.equal(result.excluded.length, 1); }
  const ordered = aggregate([event("1", "DEMO-T1", "2026-10-30T10:00:00Z", "Not Executed", "Failed", "anna", { sequence: 1 }), event("2", "DEMO-T1", "2026-10-30T10:00:00Z", "Failed", "Passed", "boris", { sequence: 2 })]);
  assert.equal(ordered.entries[0].userKey, "boris");
});
test("incomplete/wrong-scope exports, conflicting IDs and unzoned dates are rejected", () => {
  const e = event("1", "DEMO-T1", "2026-10-30T10:00:00Z", "Not Executed", "Failed");
  for (const patch of [{ complete: false }, { testRunKey: "DEMO-R2" }, { source: "" }, { startInclusive: "2026-10-30T08:00:00Z" }, { endExclusive: "2026-10-30T08:00:00Z" }, { events: [{ ...e, timestamp: "2026-10-30T10:00:00" }] }, { events: [e, { ...e, actor: "boris" }] }]) assert.throws(() => historyStatistics(history([e], patch), input.testRunKey, period, ["Not Executed"]));
});
test("full pagination handles server page caps and more than 1000 records, without exact claims", async () => {
  const records = Array.from({ length: 1203 }, (_, i) => ({ id: i + 1, testCaseKey: `DEMO-T${i + 1}`, status: "Passed", executedBy: "actual", assignedTo: "assignee", actualEndDate: "2026-10-30T10:00:00Z" }));
  const f = fixture((url) => { const p = new URL(url, "https://fixture.invalid").searchParams; assert.equal(p.get("onlyLastExecutions"), "false"); const offset = Number(p.get("startAt")); return { total: records.length, startAt: offset, values: records.slice(offset, offset + 50) }; });
  const exact = await f.tool(input);
  assert.equal(exact.quality, "HISTORY_UNAVAILABLE"); assert.equal(exact.rows, null); assert.equal(exact.totals, null); assert.equal(exact.availableEvidence.executionRecords, 1203); assert.equal(exact.availableEvidence.pagesRead, 25); assert.equal(exact.recordedSummary, undefined);
  const limited = (await f.tool({ ...input, includeRecordedSummary: true })).recordedSummary;
  assert.equal(limited.quality, "LIMITED_EXECUTION_RECORDS"); assert.equal(limited.totals.total, 1203); assert.equal(limited.rows[0].userKey, "actual");
});
test("empty records cannot prove zero work; missing executedBy never falls back to assignedTo/userKey", async () => {
  const f = fixture(() => ({ total: 0, values: [] })); assert.equal((await f.tool(input)).totals, null);
  const summary = recordedSummary([{ id: 1, testCaseKey: "DEMO-T1", status: "Passed", assignedTo: "assignee", userKey: "legacy-ambiguous", actualEndDate: "2026-10-30T10:00:00Z" }], period, ["Not Executed"]);
  assert.equal(summary.totals.total, 0); assert.equal(summary.excluded.length, 1);
});
test("pagination duplicates, stalls, changed totals and inconsistent last flags fail closed", async () => {
  for (const pages of [
    [{ total: 2, values: [{ id: 1 }] }, { total: 2, values: [{ id: 1 }] }],
    [{ total: 2, values: [] }],
    [{ total: 2, values: [{ id: 1 }] }, { total: 3, values: [{ id: 2 }] }],
    [{ total: 2, isLast: true, values: [{ id: 1 }] }],
    [{ total: 1, isLast: false, values: [{ id: 1 }] }],
    [{ total: 1, startAt: 10, values: [{ id: 1 }] }]
  ]) { let index = 0; const f = fixture(() => pages[index++]); await assert.rejects(f.tool(input), /pagination|IDs|inventory/); }
});
test("legacy flat fallback happens once and only for first-page 404/405", async () => {
  for (const status of [404, 405]) {
    const f = fixture((url) => { if (url.includes("/page?")) throw Object.assign(Error("unsupported"), { status }); return [{ id: 1, testCaseKey: "DEMO-T1", status: "Not Executed" }]; });
    const result = await f.tool(input); assert.equal(f.calls.length, 2); assert.equal(result.availableEvidence.legacyFallback, true);
  }
  for (const status of [400, 401, 403, 500]) { const f = fixture(() => { throw Object.assign(Error("failure"), { status }); }); await assert.rejects(f.tool(input), /failure/); assert.equal(f.calls.length, 1); }
  const f = fixture((url) => { if (url.includes("startAt=0")) return { total: 2, values: [{ id: 1 }] }; throw Object.assign(Error("gone"), { status: 404 }); }); await assert.rejects(f.tool(input), /gone/); assert.equal(f.calls.length, 2);
});
test("history file uses the same connection/run read, source hash and no additional HTTP", async (t) => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "testdocs-run-history-")); t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const historyPath = path.join(dir, "history.json");
  await fs.writeFile(historyPath, JSON.stringify(history([event("1", "DEMO-T1", "2026-10-30T10:00:00Z", "Not Executed", "Passed")])));
  const f = fixture(() => { throw Error("no results HTTP"); });
  const result = await f.tool({ ...input, historyPath });
  assert.equal(result.totals.total, 1); assert.match(result._testdocs.sourceSha256, /^[a-f0-9]{64}$/); assert.equal(f.calls.length, 0);
  await fs.writeFile(historyPath, JSON.stringify(history([], { instance: "https://other.invalid" })));
  await assert.rejects(f.tool({ ...input, historyPath }), /instance/);
});

function liveFixture({ removeAt, missingActor = false, missingCreation = false, failHistory, wrongSource = false } = {}) {
  const records = [1, 2].map((id) => ({ id, testCaseKey: `DEMO-T${id}`, status: id === 1 ? "Passed" : "Custom", executedBy: "untrusted-recorded-executor", actualEndDate: "2026-10-30T11:00:00Z" }));
  const run = { key: input.testRunKey, name: "Regression", items: records };
  const row = (id, sourceId, fieldName, originalValue, newValue, historyDate, userKey) => ({ id, sourceId, source: wrongSource ? "TEST_CASE" : "TEST_EXECUTION", type: "UPDATE", historyDate, userKey, changeHistoryItems: [{ id: id * 10, fieldName, originalValue, newValue }] });
  const f = fixture((url) => {
    if (url.includes("/testresults/page")) return { total: 2, values: records };
    if (url.includes(`/testrun/${input.testRunKey}?fields=`)) return { key: input.testRunKey, id: 7, projectId: 9 };
    if (url.endsWith("/project/9/testresultstatus")) return [
      { id: 1, projectId: 9, name: "Not Executed", i18nKey: "TEST_RESULT.STATUS.NOT_EXECUTED" },
      { id: 2, projectId: 9, name: "Failed", i18nKey: "TEST_RESULT.STATUS.FAIL" },
      { id: 3, projectId: 9, name: "Passed", i18nKey: "TEST_RESULT.STATUS.PASS" },
      { id: 4, projectId: 9, name: "Custom" }
    ];
    if (url.includes("/testrun/7/history")) return [{ id: 1, sourceId: 7, source: "TEST_RUN", type: "CREATE", historyDate: "2026-10-20T00:00:00Z" }, ...(removeAt ? [{ id: 2, sourceId: 7, source: "TEST_RUN", type: "TEST_CASE", historyDate: removeAt, changeHistoryItems: [{ fieldName: "TEST_CASES", originalValue: "DEMO-T99" }] }] : [])];
    const match = url.match(/\/testresult\/(\d+)\/history/);
    if (match) {
      if (failHistory) throw Object.assign(Error("History access denied"), { status: failHistory });
      const id = Number(match[1]);
      const creation = { id: id * 100, sourceId: id, source: "TEST_EXECUTION", type: "CREATE", historyDate: "2026-10-20T00:00:00Z" };
      const rows = id === 1 ? [
        row(11, id, "STATUS", "TEST_RESULT.STATUS.NOT_EXECUTED", "TEST_RESULT.STATUS.FAIL", "2026-10-30T09:00:00Z", "anna"),
        row(12, id, "STATUS", "TEST_RESULT.STATUS.FAIL", "TEST_RESULT.STATUS.PASS", "2026-10-30T10:00:00Z", missingActor ? null : "boris"),
        row(13, id, "ASSIGNED_TO", "assignee", "new-assignee", "2026-10-30T11:00:00Z", "assigner"),
        row(14, id, "TEST_SCRIPT.STEP.STATUS {\"step\":1}", "TEST_RESULT.STATUS.NOT_EXECUTED", "TEST_RESULT.STATUS.FAIL", "2026-10-30T11:30:00Z", "step-actor")
      ] : [row(21, id, "STATUS", "TEST_RESULT.STATUS.NOT_EXECUTED", "Custom", "2026-10-30T10:00:00Z", "carol")];
      if (!missingCreation) rows.push(creation);
      return { total: rows.length, startAt: 0, maxResults: 200, last: true, results: rows };
    }
    throw Error(`Unexpected ${url}`);
  }, { getRun: async () => run, jiraRequest: async (url) => { const key = new URL(url, "https://fixture.invalid").searchParams.get("key"); return { key, displayName: key.toUpperCase() }; } });
  return f;
}
test("automatic live audit uses change actors, not assignees/executedBy, with raw configured statuses", async () => {
  const f = liveFixture();
  const result = await f.tool({ ...input, historyMode: "auto" });
  assert.equal(result.quality, "HISTORY_BASED"); assert.equal(result.totals.total, 2);
  assert.deepEqual(result.rows.map((r) => [r.userKey, r.displayName, r.total]), [["boris", "BORIS", 1], ["carol", "CAROL", 1]]);
  assert.equal(result.totals.byStatus.Passed, 1); assert.equal(result.totals.byStatus.Custom, 1);
  assert.equal(result.coverageAttestedBy, "live_paginated_ui_audit_with_creation_anchors_and_membership_check");
  assert(f.calls.every((url) => !url.includes("bulk")));
});
test("live unknown actors, missing creation anchors and removed items produce partial counts", async () => {
  for (const opts of [{ missingActor: true }, { missingCreation: true }, { removeAt: "2026-10-31T10:00:00Z" }]) {
    const result = await liveFixture(opts).tool({ ...input, historyMode: "auto" });
    assert.equal(result.quality, "PARTIAL_HISTORY"); assert(result.excluded.length > 0);
  }
  const priorRemoval = await liveFixture({ removeAt: "2026-10-25T10:00:00Z" }).tool({ ...input, historyMode: "auto" });
  assert.equal(priorRemoval.quality, "HISTORY_BASED");
});
test("unavailable/version-incompatible audit returns no exact totals and no alternate route", async () => {
  for (const opts of [{ failHistory: 403 }, { failHistory: 404 }, { wrongSource: true }]) {
    const f = liveFixture(opts);
    const result = await f.tool({ ...input, historyMode: "auto", includeRecordedSummary: true });
    assert.equal(result.quality, "HISTORY_UNAVAILABLE"); assert.equal(result.totals, null); assert(result.auditFailure);
    assert.equal(result.recordedSummary.quality, "LIMITED_EXECUTION_RECORDS");
    assert.equal(f.calls.filter((url) => url.includes("/testresult/")).length, 2, "Only the current bounded batch was requested; no retries");
  }
});
test("history pagination respects server caps, validates all pages and stops on overlap/stall", async () => {
  const data = Array.from({ length: 103 }, (_, i) => ({ id: i + 1 }));
  const rows = await readAudit(async (url) => { const offset = Number(new URL(url, "https://fixture.invalid").searchParams.get("startAt")); return { results: data.slice(offset, offset + 50), total: 103, startAt: offset, last: offset + 50 >= 103 }; }, "testresult", 1);
  assert.equal(rows.length, 103);
  await assert.rejects(readAudit(async () => ({ results: [], total: 2, startAt: 0 }), "testresult", 1), /pagination/);
  await assert.rejects(readAudit(async (url) => ({ results: [{ id: 1 }], total: 2, startAt: Number(new URL(url, "https://fixture.invalid").searchParams.get("startAt")) }), "testresult", 1), /IDs/);
  await assert.rejects(readAudit(async () => { throw Error("must not request"); }, "testresult", "1/other"), /identity/);
});
test("automatic mode fails closed on concurrent run membership changes", async () => {
  let reads = 0;
  const tool = createStatisticsTool({ request: async (url) => {
    if (url.includes("/testresults/page")) return { total: 0, values: [] };
    if (url.includes("?fields=")) return { key: input.testRunKey, id: 7, projectId: 9 };
    if (url.includes("/testresultstatus")) return [{ projectId: 9, name: "Not Executed" }];
    return [{ source: "TEST_RUN", sourceId: 7, type: "CREATE", historyDate: "2026-10-20T00:00:00Z" }];
  }, getRun: async () => ({ key: input.testRunKey, items: ++reads === 1 ? [] : [{ id: 1, testCaseKey: "DEMO-T1" }] }), webUrl: () => "https://jira.example.invalid/run", now: () => NOW });
  const result = await tool({ ...input, historyMode: "auto" });
  assert.equal(result.quality, "HISTORY_UNAVAILABLE"); assert.equal(result.totals, null); assert.match(result.auditFailure.message, /changed/);
});

test("empty/partial public inventory cannot become an exact zero for a populated run", async () => {
  const f = fixture(() => ({ total: 0, values: [] }), { getRun: async () => ({ key: input.testRunKey, items: [{ id: 1, testCaseKey: "DEMO-T1" }] }) });
  const result = await f.tool({ ...input, historyMode: "auto" });
  assert.equal(result.quality, "HISTORY_UNAVAILABLE"); assert.equal(result.totals, null); assert.match(result.auditFailure.message, /inventory/);
  assert.equal(f.calls.length, 1, "Invalid inventory stops before internal audit requests");
});
