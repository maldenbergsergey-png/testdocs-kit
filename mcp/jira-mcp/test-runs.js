const crypto = require("node:crypto");
const { createStatisticsTool } = require("./test-run-statistics");

const RUN_KEY = /^[A-Za-z][A-Za-z0-9_]*-[RC]\d+$/;
const CASE_KEY = /^[A-Za-z][A-Za-z0-9_]*-T\d+$/;
const INTERNAL = "/rest/tests/1.0";
const managementTools = [
  "zephyr_get_test_run_items", "zephyr_get_test_run_folder_tree", "zephyr_update_test_run",
  "zephyr_add_test_run_items", "zephyr_remove_test_run_items", "zephyr_reorder_test_run_items",
  "zephyr_update_test_run_result", "zephyr_delete_test_run"
];

function numericId(value) {
  if (!(["number", "string"].includes(typeof value)) || String(value).trim() === "") throw new Error("Missing numeric Zephyr identity.");
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number <= 0) throw new Error("Invalid numeric Zephyr identity.");
  return number;
}

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") return Object.fromEntries(Object.keys(value).sort().filter((key) => key !== "_testdocs").map((key) => [key, canonical(value[key])]));
  return value;
}
const same = (a, b) => JSON.stringify(canonical(a)) === JSON.stringify(canonical(b));
const hash = (value) => crypto.createHash("sha256").update(JSON.stringify(canonical(value))).digest("hex");
const lastResult = (item) => item.$lastTestResult || item.lastTestResult;

function exactRun(key) {
  if (!RUN_KEY.test(key || "")) throw new Error("An exact Test Run key (PROJECT-R123 or PROJECT-C123) is required.");
}
function intent(input) {
  exactRun(input.testRunKey);
  if (input.confirmed !== true) throw new Error("Explicit user intent is required for this Test Run operation.");
  if (!/^[a-f0-9]{64}$/.test(input.expectedContentHash || "")) throw new Error("Read zephyr_get_test_run_items and supply its current contentHash as expectedContentHash.");
}
function onlyFields(input, allowed) {
  const unknown = Object.keys(input).filter((key) => !["confirmed", "testRunKey", "expectedContentHash", ...allowed].includes(key));
  if (unknown.length) throw new Error(`Unsupported Test Run fields: ${unknown.join(", ")}`);
}
function date(value) {
  if (typeof value !== "string" || !/^\d{4}-\d\d-\d\dT\d\d:\d\d(?::\d\d(?:\.\d{1,3})?)?(?:Z|[+-]\d\d:\d\d)$/.test(value) || !Number.isFinite(Date.parse(value))) {
    throw new Error("Planned dates require an ISO date-time with an explicit timezone.");
  }
  const [year, month, day] = value.slice(0, 10).split("-").map(Number);
  const calendar = new Date(`${value.slice(0, 10)}T00:00:00.000Z`);
  if (calendar.getUTCFullYear() !== year || calendar.getUTCMonth() + 1 !== month || calendar.getUTCDate() !== day) throw new Error("Invalid calendar date.");
  return new Date(value).toISOString();
}

function createTestRunTools({ request, jiraRequest, getRun, webUrl, managementEnabled = () => process.env.TESTDOCS_ENABLE_TEST_RUN_MANAGEMENT === "1" }) {
  function enabled() {
    if (!managementEnabled()) throw new Error("Test Run management is disabled. Enable it explicitly for the selected Zephyr connection; it uses the version-dependent internal API.");
    if ((process.env.TESTDOCS_TMS_PROVIDER || "zephyr_scale") !== "zephyr_scale") throw new Error("Zephyr is not the selected TMS provider.");
  }
  async function internal(path, method = "GET", body) {
    try { return await request(`${INTERNAL}${path}`, method, body); }
    catch (error) {
      error.message += "\nTest Run management uses Zephyr's unofficial internal API; 404/405 may mean this version is incompatible. No recreation or alternate mutation is attempted.";
      throw error;
    }
  }
  async function snapshot(testRunKey) {
    enabled();
    exactRun(testRunKey);
    const run = await getRun({ testRunKey });
    const identity = await internal(`/testrun/${encodeURIComponent(testRunKey)}?fields=id,projectId,key,name,folderId,plannedStartDate,plannedEndDate`);
    const id = numericId(identity?.id);
    const projectId = numericId(identity?.projectId);
    if (run?.key !== testRunKey || identity.key !== testRunKey) throw new Error("Zephyr did not confirm the exact Test Run identity.");
    const data = await internal(`/testrun/${id}/testrunitems`);
    if (!Array.isArray(data?.testRunItems) || !Array.isArray(run?.items) || data.testRunItems.length !== run.items.length ||
        (data.total !== undefined && data.total !== data.testRunItems.length) || data.isLast === false) {
      throw new Error("Incomplete Test Run item inventory; no mutation is safe.");
    }
    const items = data.testRunItems.map((item) => {
      const result = lastResult(item);
      const publicItem = run.items.find((candidate) => result?.id !== undefined && String(candidate.id) === String(result.id));
      const testCaseKey = item.testCaseKey || result?.testCase?.key || publicItem?.testCaseKey;
      if (!CASE_KEY.test(testCaseKey || "") || !publicItem || publicItem.testCaseKey !== testCaseKey || !["number", "string"].includes(typeof item.index) || String(item.index).trim() === "" || !Number.isSafeInteger(Number(item.index)) || Number(item.index) < 0 || !result || typeof result !== "object" || Array.isArray(result)) {
        throw new Error("Unsupported Test Run item shape; stable item/case/result identities are required.");
      }
      numericId(result.id);
      return { ...item, id: numericId(item.id), index: Number(item.index), testCaseKey };
    }).sort((a, b) => a.index - b.index || a.id - b.id);
    if (new Set(items.map((item) => item.id)).size !== items.length ||
        !same(items.map((item) => item.testCaseKey).sort(), run.items.map((item) => item.testCaseKey).sort())) {
      throw new Error("Inconsistent Test Run item identities; refresh before changing it.");
    }
    return { testRunKey, id, projectId, run, identity, items, contentHash: hash({ run, identity, items }) };
  }
  async function preflight(input) {
    enabled(); intent(input);
    const state = await snapshot(input.testRunKey);
    if (input.expectedContentHash !== state.contentHash) throw new Error("CONFLICT: Test Run changed since it was read. Refresh and review the new diff before writing.");
    return state;
  }
  const envelope = (state, data = {}) => ({ testRunKey: state.testRunKey, ...data, _testdocs: { ...data._testdocs, webUrl: webUrl(state.testRunKey) } });
  const unchanged = (state) => envelope(state, { changed: false, verificationStatus: "VERIFIED", contentHash: state.contentHash });
  async function mutate(state, write, verify) {
    let accepted = false;
    try {
      await write(); accepted = true;
      const after = await snapshot(state.testRunKey);
      const mismatches = verify(after);
      return envelope(state, { changed: true, mutationOutcome: "ACCEPTED", verificationStatus: mismatches.length ? "FAILED" : "VERIFIED", mismatches, contentHash: after.contentHash });
    } catch (error) {
      return envelope(state, { changed: accepted ? true : null, mutationOutcome: accepted ? "ACCEPTED" : "UNKNOWN", verificationStatus: "UNAVAILABLE", message: error.message, nextAction: "Read the same Test Run before retrying. Do not recreate it or repeat an uncertain mutation." });
    }
  }
  function preserved(before, after) {
    return before.flatMap((item) => {
      const saved = after.find((other) => item.id === other.id);
      return saved && saved.testCaseKey === item.testCaseKey && same(lastResult(saved), lastResult(item)) ? [] : [`Item ${item.id}: retained execution changed or disappeared.`];
    });
  }
  async function saveItems(state, { added = [], deleted = [], indexes = [] }) {
    return internal("/testrunitem/bulk/save", "PUT", {
      testRunId: state.id, addedTestRunItems: added, updatedTestRunItems: [],
      updatedTestRunItemsIndexes: indexes, deletedTestRunItems: deleted.map((id) => ({ id })), autoReorder: false
    });
  }
  async function reindex(state, sequence) {
    if (!sequence.some((item, index) => item.index !== index)) return;
    await saveItems(state, { indexes: sequence.map((item, index) => ({ id: item.id, index })) });
  }
  async function folderTree({ projectKey }) {
    enabled();
    if (!/^[A-Za-z][A-Za-z0-9_]*$/.test(projectKey || "")) throw new Error("An exact projectKey is required.");
    const project = await jiraRequest(`/rest/api/2/project/${encodeURIComponent(projectKey)}`);
    const projectId = numericId(project.id);
    const tree = await internal(`/project/${projectId}/foldertree/testrun`);
    return { projectKey, projectId, type: "TEST_RUN", tree, _testdocs: { readOnly: true, internalApi: true } };
  }
  function treeContains(tree, id) {
    if (!tree || typeof tree !== "object") return false;
    if (!Array.isArray(tree) && String(tree.id) === String(id)) return true;
    return Object.values(tree).some((value) => typeof value === "object" && treeContains(value, id));
  }
  async function updateRun(input) {
    onlyFields(input, ["name", "folderId", "plannedStartDate", "plannedEndDate"]);
    const patch = {};
    if (input.name !== undefined) {
      if (typeof input.name !== "string" || !input.name.trim() || input.name.length > 255) throw new Error("name must contain 1-255 characters.");
      patch.name = input.name;
    }
    for (const field of ["plannedStartDate", "plannedEndDate"]) if (input[field] !== undefined) patch[field] = date(input[field]);
    if (input.folderId !== undefined) patch.folderId = numericId(input.folderId);
    if (!Object.keys(patch).length) throw new Error("Provide at least one Test Run field to change.");
    const state = await preflight(input);
    if (patch.folderId !== undefined) {
      const folders = await folderTree({ projectKey: input.testRunKey.replace(/-[RC]\d+$/, "") });
      if (folders.projectId !== state.projectId || !treeContains(folders.tree, patch.folderId)) throw new Error("folderId is not in this project's TEST_RUN folder tree.");
    }
    const start = patch.plannedStartDate || state.identity.plannedStartDate;
    const end = patch.plannedEndDate || state.identity.plannedEndDate;
    if (start && end && Date.parse(start) > Date.parse(end)) throw new Error("plannedStartDate must not follow plannedEndDate.");
    const changes = Object.fromEntries(Object.entries(patch).filter(([key, value]) => !same(state.identity[key], value)));
    if (!Object.keys(changes).length) return unchanged(state);
    await preflight(input);
    return mutate(state, () => internal(`/testrun/${state.id}`, "PUT", { id: state.id, projectId: state.projectId, ...changes }), (after) => [
      ...Object.entries(changes).flatMap(([key, value]) => same(after.identity[key], value) ? [] : [`Field ${key} was not saved as requested.`]),
      ...preserved(state.items, after.items), ...(same(state.items.map((item) => [item.id, item.index]), after.items.map((item) => [item.id, item.index])) ? [] : ["Run item composition/order changed."])
    ]);
  }
  async function addItems(input) {
    onlyFields(input, ["items"]);
    if (!Array.isArray(input.items) || !input.items.length || input.items.some((item) => !CASE_KEY.test(item?.testCaseKey || "") || typeof item.userKey !== "string" || !item.userKey.trim() || Object.keys(item).some((key) => !["testCaseKey", "userKey"].includes(key))) || new Set(input.items.map((item) => item.testCaseKey)).size !== input.items.length) throw new Error("Provide unique testCaseKey/userKey additions.");
    const state = await preflight(input);
    if (input.items.some((item) => state.items.some((saved) => saved.testCaseKey === item.testCaseKey))) throw new Error("A requested test case is already in the run. Refresh the diff; duplicates are not added.");
    const added = [];
    for (const [index, item] of input.items.entries()) {
      const testCase = await internal(`/testcase/${encodeURIComponent(item.testCaseKey)}?fields=id,key`);
      if (testCase.key !== item.testCaseKey) throw new Error("Zephyr did not confirm the exact test case identity.");
      added.push({ index, lastTestResult: { testCaseId: numericId(testCase.id), assignedTo: item.userKey } });
    }
    await preflight(input);
    let phase = "ADD";
    const result = await mutate(state, async () => {
      await saveItems(state, { added, indexes: state.items.map((item, index) => ({ id: item.id, index: index + added.length })) });
      phase = "VERIFY_ADDITION";
      const after = await snapshot(state.testRunKey);
      const fresh = after.items.filter((item) => !state.items.some((old) => old.id === item.id));
      const retained = after.items.filter((item) => state.items.some((old) => old.id === item.id));
      if (preserved(state.items, after.items).length || fresh.length !== added.length ||
          !same(retained.map((item) => item.id), state.items.map((item) => item.id)) ||
          !same(fresh.map((item) => item.testCaseKey).sort(), input.items.map((item) => item.testCaseKey).sort())) throw new Error("Addition was accepted, but its exact composition could not be verified. Inspect the saved run.");
      phase = "APPEND_ORDER";
      await reindex(state, [...state.items.map((old) => after.items.find((item) => item.id === old.id)), ...input.items.map((addedItem) => fresh.find((item) => item.testCaseKey === addedItem.testCaseKey))]);
      phase = "VERIFY";
    }, (after) => [
      ...preserved(state.items, after.items),
      ...(same(after.items.map((item) => item.testCaseKey), [...state.items.map((item) => item.testCaseKey), ...input.items.map((item) => item.testCaseKey)]) && after.items.every((item, index) => item.index === index) ? [] : ["Saved composition/order differs from requested additions."]),
      ...input.items.flatMap((item) => {
        const actual = after.items.find((saved) => saved.testCaseKey === item.testCaseKey);
        return (lastResult(actual || {})?.assignedTo === item.userKey) ? [] : [`Assignment of ${item.testCaseKey} was not verified.`];
      })
    ]);
    if (phase !== "ADD" && result.mutationOutcome === "UNKNOWN") { result.changed = true; result.mutationOutcome = "ACCEPTED"; }
    return { ...result, phase };
  }
  async function removeItems(input) {
    onlyFields(input, ["itemIds"]);
    const ids = validateIds(input.itemIds);
    const state = await preflight(input);
    if (ids.some((id) => !state.items.some((item) => item.id === id))) throw new Error("Every itemId must belong to this Test Run. Use item IDs, not public execution IDs.");
    const survivors = state.items.filter((item) => !ids.includes(item.id));
    let phase = "REMOVE";
    const result = await mutate(state, async () => {
      await saveItems(state, { deleted: ids });
      phase = "VERIFY_REMOVAL";
      const after = await snapshot(state.testRunKey);
      if (preserved(survivors, after.items).length || !same(after.items.map((item) => item.id), survivors.map((item) => item.id))) throw new Error("Removal was accepted, but its saved composition/order was not verified.");
      phase = "RENUMBER";
      await reindex(state, after.items);
      phase = "VERIFY";
    }, (after) => [...preserved(survivors, after.items), ...(same(after.items.map((item) => item.id), survivors.map((item) => item.id)) && after.items.every((item, index) => item.index === index) ? [] : ["Removal/order verification failed."])]);
    if (phase !== "REMOVE" && result.mutationOutcome === "UNKNOWN") { result.changed = true; result.mutationOutcome = "ACCEPTED"; }
    return { ...result, phase, removedItemIds: result.verificationStatus === "VERIFIED" ? ids : undefined };
  }
  async function reorderItems(input) {
    onlyFields(input, ["itemIds"]);
    const ids = validateIds(input.itemIds);
    const state = await preflight(input);
    if (ids.length !== state.items.length || ids.some((id) => !state.items.some((item) => item.id === id))) throw new Error("Provide every current run item ID exactly once in the final order.");
    if (same(ids, state.items.map((item) => item.id)) && state.items.every((item, index) => item.index === index)) return unchanged(state);
    return mutate(state, () => saveItems(state, { indexes: ids.map((id, index) => ({ id, index })) }), (after) => [...preserved(state.items, after.items), ...(same(after.items.map((item) => item.id), ids) && after.items.every((item, index) => item.index === index) ? [] : ["Saved order differs from requested order."])]);
  }
  async function updateResult(input) {
    onlyFields(input, ["testCaseKey", "status", "assignedTo", "comment"]);
    if (!CASE_KEY.test(input.testCaseKey || "")) throw new Error("An exact testCaseKey is required.");
    const patch = {};
    for (const field of ["status", "assignedTo", "comment"]) if (input[field] !== undefined) {
      if (typeof input[field] !== "string" || (field !== "comment" && !input[field].trim())) throw new Error(`Invalid ${field}.`);
      patch[field] = input[field];
    }
    if (!Object.keys(patch).length) throw new Error("Provide execution status, assignedTo or comment to change.");
    const state = await preflight(input);
    const matches = state.items.filter((item) => item.testCaseKey === input.testCaseKey);
    if (matches.length !== 1) throw new Error("The public result endpoint requires exactly one matching case in the run; multiple configurations are ambiguous.");
    const publicItem = state.run.items.find((item) => item.testCaseKey === input.testCaseKey);
    if (Object.entries(patch).every(([key, value]) => same(publicItem[key], value))) return unchanged(state);
    return mutate(state, () => request(`/rest/atm/1.0/testrun/${encodeURIComponent(input.testRunKey)}/testcase/${encodeURIComponent(input.testCaseKey)}/testresult`, "PUT", patch), (after) => {
      const saved = after.run.items.find((item) => item.testCaseKey === input.testCaseKey);
      const untouched = Object.keys(publicItem).filter((key) => !Object.hasOwn(patch, key) && !["updatedOn", "updatedBy"].includes(key));
      return [...Object.entries(patch).flatMap(([key, value]) => saved && same(saved[key], value) ? [] : [`Execution ${key} was not saved as requested.`]),
        ...untouched.flatMap((key) => saved && same(saved[key], publicItem[key]) ? [] : [`Unrequested execution field ${key} changed.`]),
        ...preserved(state.items.filter((item) => item.id !== matches[0].id), after.items),
        ...(same(state.items.map((item) => item.id), after.items.map((item) => item.id)) ? [] : ["Run composition changed."])];
    });
  }
  async function deleteRun(input) {
    onlyFields(input, []);
    const state = await preflight(input);
    let accepted = false;
    try {
      await request(`/rest/atm/1.0/testrun/${encodeURIComponent(input.testRunKey)}`, "DELETE"); accepted = true;
      try { await getRun({ testRunKey: input.testRunKey }); }
      catch (error) {
        if (error.status === 404) return envelope(state, { deleted: true, mutationOutcome: "ACCEPTED", verificationStatus: "VERIFIED" });
        throw error;
      }
      return envelope(state, { deleted: false, mutationOutcome: "ACCEPTED", verificationStatus: "FAILED", message: "Test Run is still readable after deletion." });
    } catch (error) {
      return envelope(state, { deleted: null, mutationOutcome: accepted ? "ACCEPTED" : "UNKNOWN", verificationStatus: "UNAVAILABLE", message: error.message, nextAction: "Read the same key before retrying deletion." });
    }
  }
  return {
    zephyr_get_test_run_statistics: createStatisticsTool({ request, jiraRequest, getRun, webUrl }),
    zephyr_search_test_runs: async ({ projectKey, folder, startAt = 0, maxResults = 100 }) => {
      if (!/^[A-Za-z][A-Za-z0-9_]*$/.test(projectKey || "") || !Number.isInteger(startAt) || startAt < 0 || !Number.isInteger(maxResults) || maxResults < 1 || maxResults > 200) throw new Error("Exact projectKey and valid pagination are required.");
      const escape = (value) => value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
      if (folder !== undefined && (typeof folder !== "string" || !folder.startsWith("/"))) throw new Error("folder must be an exact absolute path.");
      const query = `projectKey = "${projectKey}"${folder === undefined ? "" : ` AND folder = "${escape(folder)}"`}`;
      const params = new URLSearchParams({ query, startAt: String(startAt), maxResults: String(maxResults) });
      const data = await request(`/rest/atm/1.0/testrun/search?${params}`);
      const values = Array.isArray(data) ? data : data?.results || data?.values;
      if (!Array.isArray(values)) throw new Error("Unsupported Test Run search response.");
      return { values, startAt, maxResults, nextStartAt: values.length === maxResults ? startAt + values.length : null, _testdocs: { readOnly: true, note: "TQL supports projectKey and folder; inspect candidate runs for other filters. A folder query may include descendants." } };
    },
    zephyr_get_test_run_results: async ({ testRunKey, startAt = 0, maxResults = 100, onlyLastExecutions = false }) => {
      exactRun(testRunKey);
      if (!Number.isInteger(startAt) || startAt < 0 || !Number.isInteger(maxResults) || maxResults < 1 || maxResults > 200 || typeof onlyLastExecutions !== "boolean") throw new Error("Invalid result pagination.");
      const params = new URLSearchParams({ startAt: String(startAt), maxResults: String(maxResults), onlyLastExecutions: String(onlyLastExecutions) });
      try {
        const page = await request(`/rest/atm/1.0/testrun/${encodeURIComponent(testRunKey)}/testresults/page?${params}`);
        if (!Array.isArray(page?.values) || !Number.isInteger(page.total)) throw new Error("Unsupported Test Run result page.");
        return { ...page, _testdocs: { readOnly: true } };
      } catch (error) {
        if (![404, 405].includes(error.status)) throw error;
        const run = await getRun({ testRunKey });
        const all = await request(`/rest/atm/1.0/testrun/${encodeURIComponent(testRunKey)}/testresults`);
        if (!Array.isArray(all) || !Array.isArray(run.items)) throw new Error("Unsupported legacy Test Run results response.");
        const ids = new Set(run.items.map((item) => String(item.id)));
        if (onlyLastExecutions && run.items.some((item) => item.id === undefined)) throw new Error("Latest execution identities are unavailable.");
        const values = onlyLastExecutions ? all.filter((item) => ids.has(String(item.id))) : all;
        return { startAt, maxResults, total: values.length, values: values.slice(startAt, startAt + maxResults), _testdocs: { readOnly: true, legacyFallback: true } };
      }
    },
    zephyr_get_test_run_items: async ({ testRunKey }) => {
      const state = await snapshot(testRunKey);
      return envelope(state, { run: state.run, identity: state.identity, items: state.items, _testdocs: { readOnly: true, internalApi: true, webUrl: webUrl(testRunKey), contentHash: state.contentHash } });
    },
    zephyr_get_test_run_folder_tree: folderTree,
    zephyr_update_test_run: updateRun,
    zephyr_add_test_run_items: addItems,
    zephyr_remove_test_run_items: removeItems,
    zephyr_reorder_test_run_items: reorderItems,
    zephyr_update_test_run_result: updateResult,
    zephyr_delete_test_run: deleteRun
  };
}
function validateIds(values) {
  if (!Array.isArray(values) || !values.length) throw new Error("A non-empty list of stable run item IDs is required.");
  const ids = values.map(numericId);
  if (new Set(ids).size !== ids.length) throw new Error("Duplicate run item IDs are not allowed.");
  return ids;
}

module.exports = { createTestRunTools, managementTools };
