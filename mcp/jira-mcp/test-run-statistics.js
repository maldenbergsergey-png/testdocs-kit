const fs = require("node:fs/promises");
const crypto = require("node:crypto");

const CASE_KEY = /^[A-Za-z][A-Za-z0-9_]*-T\d+$/;
function instant(value) {
  if (typeof value !== "string" || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,3})?(?:Z|[+-]\d\d:?\d\d)$/.test(value)) throw new Error("An instant must include seconds and an explicit UTC offset.");
  const normalized = value.replace(/([+-]\d\d)(\d\d)$/, "$1:$2");
  const time = Date.parse(normalized);
  if (!Number.isFinite(time) || Number(value.slice(11, 13)) > 23 || Number(value.slice(14, 16)) > 59 || Number(value.slice(17, 19)) > 59 || new Date(`${value.slice(0, 10)}T00:00:00Z`).toISOString().slice(0, 10) !== value.slice(0, 10)) throw new Error("Invalid timestamp.");
  return time;
}
function calendar(value) {
  if (typeof value !== "string" || !/^\d{4}-\d\d-\d\d$/.test(value) || !Number.isFinite(Date.parse(`${value}T00:00:00Z`)) || new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) !== value) throw new Error("Use a valid YYYY-MM-DD date.");
  return value;
}
function nextDay(day) { return new Date(Date.parse(`${day}T00:00:00Z`) + 86400000).toISOString().slice(0, 10); }
function dayFormatter(timeZone) {
  if (typeof timeZone !== "string" || !timeZone.trim()) throw new Error("An explicit IANA timeZone is required; use the user's known timezone.");
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" });
}
function localDay(formatter, time) {
  const parts = Object.fromEntries(formatter.formatToParts(time).map((p) => [p.type, p.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}
// First instant whose local date is at least day. Handles 23/25-hour days,
// midnight offset changes and skipped calendar days without assuming a fixed offset.
function dayBoundary(formatter, day) {
  const utc = Date.parse(`${day}T00:00:00Z`);
  let low = utc - 48 * 3600000, high = utc + 48 * 3600000;
  while (low < high) {
    const mid = low + Math.floor((high - low) / 2);
    if (localDay(formatter, mid) < day) low = mid + 1; else high = mid;
  }
  return low;
}
function resolvePeriod({ timeZone, date, startDate, endDate }, now = Date.now()) {
  const formatter = dayFormatter(timeZone);
  if (date !== undefined && (startDate !== undefined || endDate !== undefined)) throw new Error("Choose date or startDate/endDate, not both.");
  if ((startDate === undefined) !== (endDate === undefined)) throw new Error("Supply both startDate and endDate (inclusive).");
  const start = calendar(date ?? startDate ?? localDay(formatter, now));
  const end = calendar(date ?? endDate ?? start);
  if (start > end) throw new Error("startDate must not follow endDate.");
  const from = dayBoundary(formatter, start), to = dayBoundary(formatter, nextDay(end));
  if (from >= to || from >= now) throw new Error("The selected period has no elapsed time.");
  return { timeZone, startDate: start, endDate: end, startInclusive: new Date(from).toISOString(), endExclusive: new Date(to).toISOString(), observedThrough: new Date(Math.min(now, to)).toISOString(), provisional: now < to };
}
function table(entries) {
  const statuses = [...new Set(entries.map((e) => e.status))].sort();
  const rows = new Map();
  for (const e of entries) {
    if (!rows.has(e.userKey)) rows.set(e.userKey, { userKey: e.userKey, byStatus: Object.fromEntries(statuses.map((s) => [s, 0])), total: 0 });
    const row = rows.get(e.userKey); row.byStatus[e.status]++; row.total++;
  }
  return { statuses, rows: [...rows.values()].sort((a, b) => a.userKey.localeCompare(b.userKey)), totals: { byStatus: Object.fromEntries(statuses.map((s) => [s, entries.filter((e) => e.status === s).length])), total: entries.length }, uniqueCases: new Set(entries.map((e) => e.testCaseKey)).size };
}
function historyStatistics(history, testRunKey, period, initialStatuses, instance) {
  if (history?.version !== 1 || history.testRunKey !== testRunKey || typeof history.source !== "string" || !history.source.trim() || history.complete !== true || !Array.isArray(history.events)) throw new Error("A complete, source-attributed v1 status-history export for this exact run is required.");
  if (instance !== undefined && history.instance !== instance) throw new Error("The history export must belong to the selected Jira instance.");
  const from = instant(period.startInclusive), to = instant(period.observedThrough);
  if (instant(history.startInclusive) > from || instant(history.endExclusive) < to) throw new Error("History coverage must include the entire elapsed report period, including all run items/configurations and removals.");
  const initial = new Set(initialStatuses);
  const events = new Map(), excluded = new Map();
  for (const event of history.events) {
    if (!event || typeof event.id !== "string" || !event.id || typeof event.executionId !== "string" || !event.executionId || !CASE_KEY.test(event.testCaseKey || "") || typeof event.fromStatus !== "string" || !event.fromStatus || typeof event.toStatus !== "string" || !event.toStatus || (event.actor !== null && (typeof event.actor !== "string" || !event.actor.trim())) || (event.sequence !== undefined && (!Number.isSafeInteger(event.sequence) || event.sequence < 0))) throw new Error("Unsupported status event: require id, executionId, testCaseKey, fromStatus, toStatus, actor (key or null), and timestamp.");
    const time = instant(event.timestamp);
    const fingerprint = JSON.stringify([event.executionId, event.testCaseKey, event.fromStatus, event.toStatus, event.actor, time, event.sequence]);
    if (events.has(event.id) && events.get(event.id).fingerprint !== fingerprint) throw new Error("Conflicting duplicate history event ID.");
    events.set(event.id, { ...event, time, fingerprint });
  }
  const ordered = [...events.values()].filter((e) => e.time < to).sort((a, b) => a.time - b.time || (a.sequence ?? 0) - (b.sequence ?? 0));
  const streams = new Map(), latest = new Map(), qualifying = new Set(), owners = new Map();
  const formatter = dayFormatter(period.timeZone);
  for (const event of ordered) {
    if (event.fromStatus === event.toStatus) continue; // assignment/comment edits are not execution
    const stream = streams.get(event.executionId);
    if (stream && (stream.testCaseKey !== event.testCaseKey || stream.toStatus !== event.fromStatus)) {
      excluded.set(event.testCaseKey, "Discontinuous execution status history.");
      excluded.set(stream.testCaseKey, "Discontinuous execution status history.");
    }
    streams.set(event.executionId, event);
    const previous = latest.get(event.testCaseKey);
    if (previous?.time === event.time && (previous.sequence === undefined || event.sequence === undefined || previous.sequence === event.sequence)) excluded.set(event.testCaseKey, "Status event order is ambiguous at the same timestamp.");
    latest.set(event.testCaseKey, event);
    if (event.time < from) continue;
    const key = JSON.stringify([event.testCaseKey, localDay(formatter, event.time)]);
    if (initial.has(event.fromStatus) && !initial.has(event.toStatus)) qualifying.add(key);
    if (!initial.has(event.toStatus)) owners.set(key, event);
  }
  const entries = [];
  for (const key of qualifying) {
    const [testCaseKey, day] = JSON.parse(key), owner = owners.get(key), final = latest.get(testCaseKey);
    if (!owner?.actor) excluded.set(testCaseKey, "The final execution action of a qualifying day has no actual actor.");
    if (!excluded.has(testCaseKey)) entries.push({ testCaseKey, day, userKey: owner.actor, status: final.toStatus, qualifyingUnit: key, ownerEventId: owner.id, statusEventId: final.id });
  }
  // A later-discovered gap invalidates every day of that case.
  const included = entries.filter((e) => !excluded.has(e.testCaseKey));
  return { quality: excluded.size ? "PARTIAL_HISTORY" : "HISTORY_BASED", metric: "case_days_transitioned_from_initial", source: history.source, coverageAttestedBy: "supplied_export", period, ...table(included), entries: included, excluded: [...excluded].map(([testCaseKey, reason]) => ({ testCaseKey, reason })), rules: { deduplication: "testCaseKey + local calendar day across all executions/configurations", attribution: "last non-initial status-changing actor on the qualifying day", status: "last status change strictly before observedThrough, across the case's configurations; resets remain visible", periodTotal: "sum of case-days; uniqueCases is also returned" } };
}
function recordedSummary(results, period, initialStatuses) {
  const from = instant(period.startInclusive), to = instant(period.observedThrough), formatter = dayFormatter(period.timeZone);
  const candidates = new Map(), invalid = new Set(), excluded = [];
  for (const result of results) {
    const key = result.testCaseKey;
    if (!CASE_KEY.test(key || "")) { excluded.push({ executionId: result.id, reason: "Missing case identity." }); continue; }
    if (initialStatuses.includes(result.status)) continue;
    let time;
    try { time = instant(result.actualEndDate ?? result.executionDate); }
    catch { invalid.add(key); excluded.push({ testCaseKey: key, executionId: result.id, reason: "Missing/unzoned execution time." }); continue; }
    if (time < from || time >= to) continue;
    if (typeof result.executedBy !== "string" || !result.executedBy.trim() || typeof result.status !== "string" || !result.status) { invalid.add(key); excluded.push({ testCaseKey: key, executionId: result.id, reason: "Missing executedBy/status; assignedTo and userKey are not substituted." }); continue; }
    const day = localDay(formatter, time), unit = JSON.stringify([key, day]), previous = candidates.get(unit);
    if (previous?.time === time && (previous.userKey !== result.executedBy || previous.status !== result.status)) { invalid.add(key); excluded.push({ testCaseKey: key, reason: "Conflicting results at the same timestamp." }); }
    if (!previous || time > previous.time) candidates.set(unit, { testCaseKey: key, day, userKey: result.executedBy, status: result.status, executionId: result.id, time });
  }
  return { quality: "LIMITED_EXECUTION_RECORDS", metric: "recorded_execution_case_days", period, ...table([...candidates.values()].filter((e) => !invalid.has(e.testCaseKey))), excluded, limitations: ["Execution records are mutable; they do not prove Not Executed transitions, their action authors, or end-of-period historical status.", "Only executedBy and actualEndDate (legacy executionDate) are used. Counts/statuses describe saved records, not verified daily work.", "Unavailable/deleted/overwritten records cannot be reconstructed. Missing fields and ambiguous ties are excluded."] };
}

// Version-dependent UI audit, observed on Zephyr Server/DC 12.12.0.
// Unlike public results, each history row identifies an action and its changes.
async function readAudit(request, entity, id) {
  if (!["testrun", "testresult"].includes(entity) || !/^\d+$/.test(String(id)) || !Number.isSafeInteger(Number(id)) || Number(id) <= 0) throw new Error("Unsupported numeric audit identity.");
  const rows = [], ids = new Set();
  let offset = 0, total;
  do {
    const page = await request(`/rest/tests/1.0/${entity}/${id}/history?startAt=${offset}&maxResults=200`);
    // The older Test Run history endpoint returns an unpaged array.
    if (entity === "testrun" && Array.isArray(page) && offset === 0) return page;
    if (!Array.isArray(page?.results) || !Number.isSafeInteger(page.total) || page.total < 0 || page.startAt !== offset || (total !== undefined && page.total !== total) || (!page.results.length && offset < page.total)) throw new Error("Incomplete/changing audit pagination.");
    total = page.total;
    for (const row of page.results) {
      if (!row || row.id === undefined || ids.has(String(row.id))) throw new Error("Missing/overlapping audit IDs.");
      ids.add(String(row.id)); rows.push(row);
    }
    offset += page.results.length;
    if (offset > total || (page.last === true && offset < total) || (page.last === false && offset === total)) throw new Error("Contradictory audit pagination.");
  } while (offset < total);
  return rows;
}
async function liveHistory({ request, getRun, run, records, period, initialStatuses, instance }) {
  if (records.some((r) => !CASE_KEY.test(r.testCaseKey || "") || !/^\d+$/.test(String(r.id)) || !Number.isSafeInteger(Number(r.id)) || Number(r.id) <= 0)) throw new Error("Unsupported public execution identity for the internal audit.");
  const byId = new Map(records.map((r) => [String(r.id), r.testCaseKey]));
  if (!Array.isArray(run.items) || new Set(run.items.map((i) => String(i.id))).size !== run.items.length || run.items.some((i) => byId.get(String(i.id)) !== i.testCaseKey)) throw new Error("Public result inventory does not contain every current run execution.");
  const identity = await request(`/rest/tests/1.0/testrun/${encodeURIComponent(run.key)}?fields=id,projectId,key`);
  if (identity?.key !== run.key || !Number.isSafeInteger(identity.id) || identity.id <= 0 || !Number.isSafeInteger(identity.projectId) || identity.projectId <= 0) throw new Error("Unsupported internal Test Run identity.");
  const statuses = await request(`/rest/tests/1.0/project/${identity.projectId}/testresultstatus`);
  if (!Array.isArray(statuses) || !statuses.length || statuses.some((s) => typeof s.name !== "string" || !s.name || s.projectId !== identity.projectId)) throw new Error("Unsupported execution status dictionary.");
  const mapping = new Map();
  for (const status of statuses) for (const value of [status.name, status.i18nKey, status.id === undefined ? undefined : String(status.id)]) {
    if (value === undefined || value === "") continue;
    if (mapping.has(value) && mapping.get(value) !== status.name) throw new Error("Ambiguous execution status dictionary.");
    mapping.set(value, status.name);
  }
  if (initialStatuses.some((s) => !statuses.some((status) => status.name === s))) throw new Error("An initial status is absent from the project's execution status dictionary.");
  const runAudit = await readAudit(request, "testrun", identity.id);
  const from = instant(period.startInclusive), cutoff = instant(period.observedThrough);
  const gaps = new Map(), events = [];
  if (!runAudit.some((row) => row.type === "CREATE")) throw new Error("Test Run audit has no creation anchor; complete membership history is unverified.");
  for (const row of runAudit) {
    if (row.source !== "TEST_RUN" || String(row.sourceId) !== String(identity.id)) throw new Error("Audit belongs to a different Test Run.");
    const time = instant(row.historyDate);
    for (const change of row.changeHistoryItems || []) if (change.fieldName === "TEST_CASES" && time >= from && change.originalValue) {
      const removed = change.originalValue.split(",").map((s) => s.trim());
      if (removed.some((key) => !CASE_KEY.test(key))) throw new Error("Unsupported removed-case identity in membership audit.");
      for (const key of removed) gaps.set(key, "Item removed since the report start; its deleted execution audit cannot be reconstructed.");
    }
  }
  let auditRows = runAudit.length;
  // Bound concurrent reads; histories are independent, and every page is validated.
  for (let offset = 0; offset < records.length; offset += 4) {
    const batch = records.slice(offset, offset + 4);
    const results = await Promise.allSettled(batch.map((record) => readAudit(request, "testresult", record.id)));
    for (const [index, result] of results.entries()) {
      const record = batch[index], key = record.testCaseKey;
      if (!CASE_KEY.test(key || "") || !/^\d+$/.test(String(record.id))) throw new Error("Unsupported public execution identity.");
      if (result.status === "rejected") throw result.reason; // no retry or repeated capability probes
      const rows = result.value;
      auditRows += rows.length;
      const creation = rows.filter((row) => row.type === "CREATE");
      if (creation.length !== 1) { gaps.set(key, "Execution audit requires exactly one creation anchor."); continue; }
      const stream = [];
      for (const row of rows) {
        if (row.source !== "TEST_EXECUTION" || String(row.sourceId) !== String(record.id)) throw new Error("Audit belongs to a different execution.");
        instant(row.historyDate);
        if (!["CREATE", "UPDATE"].includes(row.type)) { gaps.set(key, "Unsupported execution audit event type."); continue; }
        for (const change of row.changeHistoryItems || []) if (change.fieldName === "STATUS") {
          const before = mapping.get(change.originalValue), after = mapping.get(change.newValue);
          if (!before || !after || change.id === undefined) { gaps.set(key, "Unresolved status or change identity in execution audit."); continue; }
          stream.push({ id: `${row.id}:${change.id}`, executionId: String(record.id), testCaseKey: key, timestamp: row.historyDate, fromStatus: before, toStatus: after, actor: typeof row.userKey === "string" && row.userKey.trim() ? row.userKey : null });
        }
      }
      stream.sort((a, b) => instant(a.timestamp) - instant(b.timestamp));
      if (stream.length && instant(stream[0].timestamp) < instant(creation[0].historyDate)) gaps.set(key, "Status history predates the execution creation anchor.");
      if (stream.length && !initialStatuses.includes(stream[0].fromStatus)) gaps.set(key, "The first audited status change has no initial-state baseline.");
      if (!stream.length && !initialStatuses.includes(record.status)) gaps.set(key, "Executed result has no corresponding status audit.");
      // Compare against current state only if its execution was already complete at cutoff.
      // Later events are preserved as evidence but never replace historical cutoff status.
      if (stream.length && stream.at(-1).toStatus !== record.status && instant(stream.at(-1).timestamp) < cutoff) gaps.set(key, "Latest audited status does not match the saved result; history may be incomplete or changing.");
      events.push(...stream);
    }
  }
  const after = await getRun({ testRunKey: run.key });
  const members = (r) => Array.isArray(r?.items) ? JSON.stringify(r.items.map((i) => [String(i.id), i.testCaseKey]).sort()) : null;
  if (after?.key !== run.key || !members(run) || members(run) !== members(after)) throw new Error("Test Run membership/execution identity changed during audit collection. Read again after it is stable.");
  const report = historyStatistics({ version: 1, instance, testRunKey: run.key, source: `/rest/tests/1.0/testresult/{executionId}/history; project ${identity.projectId}; membership audit /testrun/${identity.id}/history`, complete: true, startInclusive: period.startInclusive, endExclusive: period.observedThrough, events: events.filter((e) => !gaps.has(e.testCaseKey)) }, run.key, period, initialStatuses, instance);
  report.excluded.push(...[...gaps].map(([testCaseKey, reason]) => ({ testCaseKey, reason })));
  if (report.excluded.length) report.quality = "PARTIAL_HISTORY";
  report.coverageAttestedBy = "live_paginated_ui_audit_with_creation_anchors_and_membership_check";
  report.evidence = { executionRecords: records.length, auditRows, statusEvents: events.length, runId: identity.id, projectId: identity.projectId, internalApi: true };
  report.limitations = ["Version-dependent internal API, verified on Zephyr 12.12.0; no vendor-supported atomic snapshot. Missing creation anchors, removed items and unverifiable cases are excluded."];
  return report;
}

function createStatisticsTool({ request, jiraRequest, getRun, webUrl, now = Date.now }) {
  async function names(report) {
    if (!jiraRequest) return report;
    for (const row of report.rows || []) {
      try {
        const user = await jiraRequest(`/rest/api/2/user?key=${encodeURIComponent(row.userKey)}`);
        if (user?.key === row.userKey && typeof user.displayName === "string" && user.displayName.trim()) row.displayName = user.displayName;
      } catch { /* Deleted/restricted users retain the exact execution actor key. */ }
    }
    return report;
  }
  return async function statistics(input) {
    const unknown = Object.keys(input).filter((key) => !["testRunKey", "timeZone", "date", "startDate", "endDate", "initialStatuses", "historyPath", "historyMode", "includeRecordedSummary"].includes(key));
    if (unknown.length || (input.includeRecordedSummary !== undefined && typeof input.includeRecordedSummary !== "boolean")) throw new Error("Unsupported statistics fields or includeRecordedSummary value.");
    if (!/^[A-Za-z][A-Za-z0-9_]*-[RC]\d+$/.test(input.testRunKey || "")) throw new Error("An exact Test Run key is required.");
    if (input.historyMode !== undefined && !["auto", "public_records"].includes(input.historyMode)) throw new Error("Unsupported historyMode.");
    const period = resolvePeriod(input, now());
    const initialStatuses = input.initialStatuses ?? ["Not Executed"];
    if (!Array.isArray(initialStatuses) || !initialStatuses.length || initialStatuses.some((s) => typeof s !== "string" || !s.trim()) || new Set(initialStatuses).size !== initialStatuses.length) throw new Error("initialStatuses must contain unique exact initial status names.");
    const run = await getRun({ testRunKey: input.testRunKey });
    if (run?.key !== input.testRunKey) throw new Error("Zephyr did not confirm the exact Test Run identity.");
    const meta = { readOnly: true, webUrl: webUrl(input.testRunKey), initialStatuses };
    if (input.historyPath !== undefined) {
      if (typeof input.historyPath !== "string" || !require("node:path").isAbsolute(input.historyPath)) throw new Error("historyPath must be the absolute path of the supplied history export.");
      const file = await fs.open(input.historyPath, "r");
      let bytes;
      try { const stat = await file.stat(); if (!stat.isFile() || stat.size > 100 * 1024 * 1024) throw new Error("History export must be a regular JSON file of at most 100 MiB."); bytes = await file.readFile(); if (bytes.length > 100 * 1024 * 1024) throw new Error("History export exceeds 100 MiB."); } finally { await file.close(); }
      const report = await names(historyStatistics(JSON.parse(bytes), input.testRunKey, period, initialStatuses, new URL(webUrl(input.testRunKey)).origin));
      return { testRunKey: input.testRunKey, name: run.name, ...report, _testdocs: { ...meta, sourceSha256: crypto.createHash("sha256").update(bytes).digest("hex"), note: "Export completeness/provenance are supplied evidence, not independently verified by the public API." } };
    }
    const values = [], ids = new Set();
    let offset = 0, total, legacy = false, pagesRead = 0;
    do {
      let page;
      try {
        const params = new URLSearchParams({ startAt: String(offset), maxResults: "200", onlyLastExecutions: "false" });
        page = await request(`/rest/atm/1.0/testrun/${encodeURIComponent(input.testRunKey)}/testresults/page?${params}`);
      } catch (error) {
        if (offset !== 0 || ![404, 405].includes(error.status)) throw error;
        const all = await request(`/rest/atm/1.0/testrun/${encodeURIComponent(input.testRunKey)}/testresults`);
        if (!Array.isArray(all)) throw new Error("Unsupported legacy results list.");
        page = { total: all.length, values: all }; legacy = true;
      }
      pagesRead++;
      if (!Array.isArray(page?.values) || !Number.isSafeInteger(page.total) || page.total < 0 || (page.startAt !== undefined && page.startAt !== offset) || (total !== undefined && page.total !== total) || (offset < page.total && !page.values.length)) throw new Error("Incomplete or changing result pagination; no statistics are reliable. Read again after the run is stable.");
      total = page.total;
      for (const item of page.values) {
        if (!item || !["string", "number"].includes(typeof item.id) || !String(item.id).trim() || ids.has(String(item.id))) throw new Error("Missing/duplicate execution IDs across pages; inventory is unreliable.");
        ids.add(String(item.id)); values.push(item);
      }
      offset += page.values.length;
      if (offset > total || (page.isLast === true && offset < total) || (page.isLast === false && offset === total)) throw new Error("Contradictory result pagination.");
    } while (offset < total);
    let auditFailure;
    if (input.historyMode !== "public_records") {
      try {
        const report = await names(await liveHistory({ request, getRun, run, records: values, period, initialStatuses, instance: new URL(webUrl(input.testRunKey)).origin }));
        return { testRunKey: input.testRunKey, name: run.name, ...report, _testdocs: { ...meta, internalApi: true } };
      } catch (error) { auditFailure = { message: error.message, ...(error.status === undefined ? {} : { httpStatus: error.status }) }; }
    }
    return { testRunKey: input.testRunKey, name: run.name, quality: "HISTORY_UNAVAILABLE", period, rows: null, totals: null, reason: "Complete status-transition history could not be verified. Public Server/DC execution records alone cannot establish exact daily statistics.", ...(auditFailure ? { auditFailure } : {}), availableEvidence: { executionRecords: values.length, pagesRead, legacyFallback: legacy }, ...(input.includeRecordedSummary === true ? { recordedSummary: await names(recordedSummary(values, period, initialStatuses)) } : {}), nextAction: "Use a verified full status-history export via historyPath, or a clearly labelled limited saved-execution summary. Do not present that summary as daily transition statistics.", _testdocs: meta };
  };
}
module.exports = { createStatisticsTool, resolvePeriod, historyStatistics, recordedSummary, readAudit };
