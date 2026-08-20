require("dotenv").config({ quiet: true });
const crypto = require("node:crypto");

const {
  createAuthRequiredError,
  getCookieHeader,
  isAuthenticationFailure
} = require("../session-auth.cjs");

const {
  JIRA_URL,
  JIRA_EMAIL,
  JIRA_TOKEN,
  JIRA_AUTH_MODE = "basic",
  JIRA_API_VERSION = "3",
  JIRA_INSECURE_TLS = "0",
  JIRA_SESSION_FILE,
  JIRA_TEST_CASE_URL_TEMPLATE
} = process.env;

if (JIRA_INSECURE_TLS === "1") {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
}

function buildAuthHeader() {
  if (JIRA_AUTH_MODE === "browser_session") return null;

  if (!JIRA_TOKEN) {
    throw new Error("JIRA_TOKEN is required");
  }

  if (JIRA_AUTH_MODE === "bearer") {
    return `Bearer ${JIRA_TOKEN}`;
  }

  if (!JIRA_EMAIL) {
    throw new Error("JIRA_EMAIL is required when JIRA_AUTH_MODE=basic");
  }

  return `Basic ${Buffer.from(`${JIRA_EMAIL}:${JIRA_TOKEN}`).toString("base64")}`;
}

function buildAuthHeaders(url) {
  if (JIRA_AUTH_MODE === "browser_session") {
    return { Cookie: getCookieHeader(JIRA_SESSION_FILE, url, "jira") };
  }
  return { Authorization: buildAuthHeader() };
}

async function fetchWithNetworkDetails(url, options, system) {
  try {
    return await fetch(url, options);
  } catch (error) {
    const cause = error.cause?.code || error.cause?.message || error.message;
    throw new Error(`${system} network request failed for ${url}: ${cause}`);
  }
}

async function jiraRequest(path, method = "GET", body) {
  if (!JIRA_URL) {
    throw new Error("JIRA_URL is required");
  }

  const url = `${JIRA_URL}${path}`;
  const res = await fetchWithNetworkDetails(url, {
    method,
    redirect: "manual",
    headers: {
      ...buildAuthHeaders(url),
      Accept: "application/json",
      "Content-Type": "application/json"
    },
    body: body ? JSON.stringify(body) : undefined
  }, "Jira");

  const contentType = res.headers.get("content-type") || "";
  const rawText = await res.text();
  if (JIRA_AUTH_MODE === "browser_session" && isAuthenticationFailure(res, rawText)) {
    throw createAuthRequiredError("jira", "Сессия Jira отсутствует или истекла.");
  }
  const trimmedText = rawText.trim();
  const looksLikeJson =
    contentType.includes("application/json") ||
    trimmedText.startsWith("{") ||
    trimmedText.startsWith("[");

  let data = rawText;
  if (looksLikeJson && rawText) {
    try {
      data = JSON.parse(rawText);
    } catch (parseError) {
      throw new Error(
        `Jira returned invalid JSON (${res.status}) from ${url}: ${parseError.message}. Body starts with: ${rawText.slice(0, 200)}`
      );
    }
  }

  if (!res.ok) {
    const details =
      typeof data === "string" ? data.slice(0, 300) : JSON.stringify(data);

    throw new Error(
      `Jira request failed (${res.status} ${res.statusText}) for ${url}. Content-Type: ${contentType || "unknown"}. Body: ${details}`
    );
  }

  if (!rawText) {
    return {};
  }

  if (!looksLikeJson) {
    throw new Error(
      `Jira returned non-JSON response (${res.status}) for ${url}. Content-Type: ${contentType || "unknown"}. Body starts with: ${rawText.slice(0, 300)}`
    );
  }

  return data;
}

async function getIssue({ key }) {
  return jiraRequest(`/rest/api/${JIRA_API_VERSION}/issue/${key}`);
}

async function addComment({ key, comment }) {
  return jiraRequest(`/rest/api/${JIRA_API_VERSION}/issue/${key}/comment`, "POST", {
    body: {
      type: "doc",
      version: 1,
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: comment }]
        }
      ]
    }
  });
}

function splitWikiRow(line) {
  const delimiter = line.startsWith("||") ? "||" : "|";
  const source = line.slice(delimiter.length, -delimiter.length);
  const cells = [];
  let current = "";
  for (let index = 0; index < source.length; index += 1) {
    if (source[index] === "\\" && source[index + 1] === "|") {
      current += "|";
      index += 1;
    } else if (source.startsWith(delimiter, index)) {
      cells.push(current);
      current = "";
      index += delimiter.length - 1;
    } else {
      current += source[index];
    }
  }
  cells.push(current);
  return cells;
}

function plainWikiText(value) {
  return String(value || "")
    .replace(/\{color:[^}]+\}/g, "")
    .replace(/\{color\}/g, "")
    .replace(/^\*|\*$/g, "")
    .trim();
}

function adfParagraph(value) {
  const text = plainWikiText(value);
  return { type: "paragraph", content: text ? [{ type: "text", text }] : [] };
}

function jiraWikiChecklistToAdf(markup) {
  const content = [];
  let tableRows = [];
  const flushTable = () => {
    if (!tableRows.length) return;
    content.push({ type: "table", attrs: { isNumberColumnEnabled: false, layout: "default" }, content: tableRows });
    tableRows = [];
  };
  for (const rawLine of String(markup || "").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) {
      flushTable();
      continue;
    }
    if (line.startsWith("h2. ")) {
      flushTable();
      content.push({ type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: line.slice(4).trim() }] });
      continue;
    }
    if ((line.startsWith("||") && line.endsWith("||")) || (line.startsWith("|") && line.endsWith("|"))) {
      const header = line.startsWith("||");
      tableRows.push({
        type: "tableRow",
        content: splitWikiRow(line).map((cell) => ({
          type: header ? "tableHeader" : "tableCell",
          attrs: {},
          content: [adfParagraph(cell)]
        }))
      });
      continue;
    }
    flushTable();
    content.push(adfParagraph(line));
  }
  flushTable();
  return { type: "doc", version: 1, content };
}

async function publishChecklistComment({ confirmed, key, content }) {
  if (confirmed !== true) {
    throw new Error("Explicit user confirmation is required to publish a Jira checklist comment.");
  }
  if (!key || typeof content !== "string" || !content.trim()) {
    throw new Error("key and non-empty checklist content are required.");
  }
  if (!content.includes("||Номер||")) {
    throw new Error("Checklist content must contain a supported Jira Wiki table header.");
  }
  const body = String(JIRA_API_VERSION) === "3" ? jiraWikiChecklistToAdf(content) : content;
  const result = await jiraRequest(
    `/rest/api/${JIRA_API_VERSION}/issue/${encodeURIComponent(key)}/comment`,
    "POST",
    { body }
  );
  return {
    ...result,
    _testdocs: {
      published: true,
      issueKey: key,
      commentId: result?.id ? String(result.id) : "",
      format: String(JIRA_API_VERSION) === "3" ? "adf" : "jira_wiki"
    }
  };
}

async function transitionIssue({ key, transitionId }) {
  return jiraRequest(`/rest/api/${JIRA_API_VERSION}/issue/${key}/transitions`, "POST", {
    transition: { id: transitionId }
  });
}

async function getTransitions({ key }) {
  return jiraRequest(`/rest/api/${JIRA_API_VERSION}/issue/${key}/transitions`);
}

async function searchIssues({ jql, maxResults = 10 }) {
  return jiraRequest(`/rest/api/${JIRA_API_VERSION}/search`, "POST", {
    jql,
    maxResults
  });
}

// --- Zephyr Scale (Test Management) methods ---

async function zephyrRequest(path, method = "GET", body) {
  if (!JIRA_URL) {
    throw new Error("JIRA_URL is required");
  }

  const url = `${JIRA_URL}${path}`;
  const res = await fetchWithNetworkDetails(url, {
    method,
    redirect: "manual",
    headers: {
      ...buildAuthHeaders(url),
      Accept: "application/json",
      "Content-Type": "application/json"
    },
    body: body ? JSON.stringify(body) : undefined
  }, "Zephyr");

  const contentType = res.headers.get("content-type") || "";
  const rawText = await res.text();
  if (JIRA_AUTH_MODE === "browser_session" && isAuthenticationFailure(res, rawText)) {
    throw createAuthRequiredError("jira", "Сессия Jira/Zephyr отсутствует или истекла.");
  }
  const trimmedText = rawText.trim();
  const looksLikeJson =
    contentType.includes("application/json") ||
    trimmedText.startsWith("{") ||
    trimmedText.startsWith("[");

  let data = rawText;
  if (looksLikeJson && rawText) {
    try {
      data = JSON.parse(rawText);
    } catch (parseError) {
      throw new Error(
        `Zephyr returned invalid JSON (${res.status}) from ${url}: ${parseError.message}. Body starts with: ${rawText.slice(0, 200)}`
      );
    }
  }

  if (!res.ok) {
    const details =
      typeof data === "string" ? data.slice(0, 300) : JSON.stringify(data);

    const error = new Error(
      `Zephyr request failed (${res.status}) for ${url}. Body: ${details}`
    );
    error.status = res.status;
    error.url = url;
    throw error;
  }

  if (!rawText) {
    return {};
  }

  if (!looksLikeJson) {
    throw new Error(
      `Zephyr returned non-JSON response (${res.status}) for ${url}. Body starts with: ${rawText.slice(0, 300)}`
    );
  }

  return data;
}

async function zephyrGetProjects() {
  return zephyrRequest("/rest/tests/1.0/project");
}

async function zephyrGetProject({ projectId }) {
  return zephyrRequest(`/rest/tests/1.0/project/${projectId}`);
}

function testCaseProjectKey(testCaseKey) {
  const match = String(testCaseKey || "").match(/^(.+)-T\d+$/i);
  return match?.[1] || null;
}

function buildTestCaseWebUrl(testCaseKey) {
  if (!testCaseKey || !JIRA_URL) return null;
  const template = JIRA_TEST_CASE_URL_TEMPLATE || `${JIRA_URL}/secure/Tests.jspa#/testCase/{key}`;
  if (!template.includes("{key}")) return null;
  const projectKey = testCaseProjectKey(testCaseKey) || "";
  return template
    .replaceAll("{key}", encodeURIComponent(testCaseKey))
    .replaceAll("{projectKey}", encodeURIComponent(projectKey));
}

function withTestCaseWebUrl(testCase, fallbackKey) {
  if (!testCase || typeof testCase !== "object") return testCase;
  const key = testCase.key || testCase.testCaseKey || fallbackKey;
  const webUrl = buildTestCaseWebUrl(key);
  if (!webUrl) return testCase;
  return {
    ...testCase,
    _testdocs: {
      ...(testCase._testdocs || {}),
      webUrl
    }
  };
}

function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).filter((key) => key !== "_testdocs").sort()
      .map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function withTestCaseFingerprint(testCase, complete) {
  if (!testCase || typeof testCase !== "object") return testCase;
  return {
    ...testCase,
    _testdocs: {
      ...(testCase._testdocs || {}),
      complete,
      contentHash: complete
        ? crypto.createHash("sha256").update(stableJson(testCase)).digest("hex")
        : null
    }
  };
}

function normalizeZephyrSearchResult(data) {
  if (Array.isArray(data)) {
    return { results: data.map((item) => withTestCaseWebUrl(item)), total: data.length };
  }
  const rawResults = Array.isArray(data?.results)
    ? data.results
    : Array.isArray(data?.values)
      ? data.values
      : [];
  return {
    ...(data || {}),
    results: rawResults.map((item) => withTestCaseWebUrl(item))
  };
}

function escapeTqlValue(value) {
  return String(value).replaceAll("\\", "\\\\").replaceAll('"', '\\"');
}

async function zephyrAtmSearchTestCases({ projectKey, fields, query, maxResults, offset }) {
  const params = new URLSearchParams();
  if (fields) params.set("fields", fields);
  const projectClause = `projectKey = "${escapeTqlValue(projectKey)}"`;
  params.set("query", query ? `${projectClause} AND (${query})` : projectClause);
  params.set("maxResults", String(maxResults));
  params.set("startAt", String(offset));
  return normalizeZephyrSearchResult(
    await zephyrRequest(`/rest/atm/1.0/testcase/search?${params.toString()}`)
  );
}

async function resolveProjectKey(projectId) {
  if (!projectId) return null;
  const project = await zephyrGetProject({ projectId });
  return project?.key || project?.projectKey || project?.project?.key || null;
}

async function zephyrSearchTestCases({ projectId, projectKey, fields, query, maxResults = 50, offset = 0 }) {
  // Note: Zephyr Scale API has a maximum effective maxResults of 1000
  // Beyond that, it returns empty results. Pagination via offset doesn't work reliably.
  // Also, 'fields' parameter is required by the API
  const effectiveMaxResults = Math.min(Math.max(maxResults, 1), 1000);
  const defaultFields = "id,key,name,objective,precondition,status,priority,createdOn,updatedOn";

  if (projectKey) {
    return zephyrAtmSearchTestCases({
      projectKey,
      fields: fields || defaultFields,
      query,
      maxResults: effectiveMaxResults,
      offset
    });
  }

  if (!projectId) throw new Error("projectId or projectKey is required.");

  const params = new URLSearchParams();
  params.set("projectId", projectId);
  params.set("fields", fields || defaultFields);
  if (query) params.set("query", query);
  params.set("maxResults", String(effectiveMaxResults));
  params.set("offset", String(offset));
  try {
    return normalizeZephyrSearchResult(
      await zephyrRequest(`/rest/tests/1.0/testcase/search?${params.toString()}`)
    );
  } catch (error) {
    if (![400, 404, 405, 500].includes(error.status)) throw error;
    let resolvedProjectKey;
    try {
      resolvedProjectKey = await resolveProjectKey(projectId);
    } catch {
      throw error;
    }
    if (!resolvedProjectKey) throw error;
    return zephyrAtmSearchTestCases({
      projectKey: resolvedProjectKey,
      fields: fields || defaultFields,
      query,
      maxResults: effectiveMaxResults,
      offset
    });
  }
}

async function zephyrGetTestPlans({ projectId, maxResults = 50, offset = 0 }) {
  const params = new URLSearchParams();
  params.set("projectId", projectId);
  params.set("maxResults", String(maxResults));
  params.set("offset", String(offset));
  return zephyrRequest(`/rest/tests/1.0/testplan?${params.toString()}`);
}

async function zephyrGetTestPlan({ testPlanKey }) {
  return zephyrRequest(`/rest/tests/1.0/testplan/${testPlanKey}`);
}

async function zephyrGetIterations({ projectId }) {
  return zephyrRequest(`/rest/tests/1.0/iteration?projectId=${projectId}`);
}

function normalizeZephyrTestCase(testCase) {
  const steps = testCase?.testScript?.steps;
  if (!Array.isArray(steps)) return testCase;

  return {
    ...testCase,
    testScript: {
      ...testCase.testScript,
      steps: [...steps].sort((left, right) => {
        const leftIndex = Number.isFinite(Number(left?.index)) ? Number(left.index) : 0;
        const rightIndex = Number.isFinite(Number(right?.index)) ? Number(right.index) : 0;
        return leftIndex - rightIndex;
      })
    }
  };
}

async function zephyrGetTestCase({ projectId, testCaseKey }) {
  const encodedKey = encodeURIComponent(testCaseKey);

  // Zephyr Scale Server/DC and legacy TM4J expose the complete current case,
  // including step-by-step scripts, through the ATM compatibility endpoint.
  try {
    const completeCase = await zephyrRequest(`/rest/atm/1.0/testcase/${encodedKey}`);
    return withTestCaseFingerprint(
      withTestCaseWebUrl(normalizeZephyrTestCase(completeCase), testCaseKey),
      true
    );
  } catch (error) {
    // Keep compatibility with installations that expose only the newer
    // /rest/tests/1.0 search API. Authentication and permission errors must
    // remain visible instead of being hidden by a metadata fallback.
    if (![404, 405, 500].includes(error.status)) throw error;
  }

  // The direct /rest/tests/1.0/testcase/{key} endpoint returns 500 on some
  // installations, so use search as a metadata-only fallback.
  const result = await zephyrSearchTestCases({
    projectId,
    projectKey: !projectId ? testCaseProjectKey(testCaseKey) : undefined,
    maxResults: 1000,
    fields: "id,key,name,objective,precondition,priority,status,createdOn,updatedOn,labels,statusName,scriptType,version"
  });

  const testCase = result.results?.find(tc => tc.key === testCaseKey);
  if (!testCase) {
    throw new Error(`Test case ${testCaseKey} not found in project ${projectId}`);
  }
  return withTestCaseFingerprint(withTestCaseWebUrl({
    ...testCase,
    _testdocs: {
      ...(testCase._testdocs || {}),
      complete: false,
      warning: "The connected Zephyr API returned metadata only; test steps are unavailable on this installation."
    }
  }, testCaseKey), false);
}

async function zephyrGetAllTestCases({ projectId, projectKey, fields }) {
  // Get ALL test cases from a project (up to 1000 max from API)
  // Returns only the first 1000, but that covers most projects
  const result = await zephyrSearchTestCases({
    projectId,
    projectKey,
    maxResults: 1000,
    fields: fields || "id,key,name,objective,precondition,status,priority,createdOn,updatedOn"
  });
  return result.results || [];
}

function escapeHtmlText(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function escapeHtmlAttribute(value) {
  return escapeHtmlText(value).replace(/"/g, "&quot;");
}

function toTmsRichText(value) {
  return String(value)
    .replace(/\r\n?/g, "\n")
    .replace(/\[([^\]\r\n]+)\]\((https?:\/\/[^\s)]+)\)/g, (_match, label, url) =>
      `<a href="${escapeHtmlAttribute(url)}">${escapeHtmlText(label)}</a>`
    )
    .split("\n")
    .join("<br>");
}

function isEmptyTestData(value) {
  return /^(?:не\s+требуется|не\s+требуются|нет|—|-)\.?$/iu.test(String(value).trim());
}

function normalizeTestStep({ description, testData, expectedResult }) {
  const normalized = {
    description: toTmsRichText(description),
    expectedResult: toTmsRichText(expectedResult)
  };
  if (typeof testData === "string" && testData.trim() && !isEmptyTestData(testData)) {
    normalized.testData = toTmsRichText(testData);
  }
  return normalized;
}

async function zephyrCreateTestCase({
  confirmed,
  projectKey,
  folder,
  name,
  objective,
  precondition,
  status,
  priority,
  labels,
  issueLinks,
  customFields,
  steps
}) {
  if (confirmed !== true) {
    throw new Error("Explicit user confirmation is required to create a test case.");
  }
  if (!projectKey || !folder || !folder.startsWith("/") || !name || !Array.isArray(steps) || !steps.length) {
    throw new Error("projectKey, folder, name and at least one complete step are required.");
  }
  if (steps.some((step) => !step?.description || !step?.expectedResult)) {
    throw new Error("Every test step requires description and expectedResult.");
  }

  const payload = {
    projectKey,
    folder,
    name,
    ...(objective ? { objective: toTmsRichText(objective) } : {}),
    ...(precondition ? { precondition: toTmsRichText(precondition) } : {}),
    ...(status ? { status } : {}),
    ...(priority ? { priority } : {}),
    ...(labels?.length ? { labels } : {}),
    ...(issueLinks?.length ? { issueLinks } : {}),
    ...(customFields && Object.keys(customFields).length ? { customFields } : {}),
    testScript: {
      type: "STEP_BY_STEP",
      steps: steps.map(normalizeTestStep)
    }
  };

  const result = await zephyrRequest("/rest/atm/1.0/testcase", "POST", payload);
  return withTestCaseWebUrl(result);
}

function hasOwn(input, field) {
  return Object.prototype.hasOwnProperty.call(input, field);
}

async function zephyrUpdateSessionTestCase(input) {
  const {
    confirmed,
    testCaseKey,
    name,
    objective,
    precondition,
    priority,
    labels,
    customFields,
    steps
  } = input;

  if (confirmed !== true) {
    throw new Error("Explicit user confirmation is required to update a session-created test case.");
  }
  if (!testCaseKey) {
    throw new Error("testCaseKey is required.");
  }
  const forbiddenFields = ["projectKey", "folder", "status", "issueLinks"];
  const forbiddenField = forbiddenFields.find((field) => hasOwn(input, field));
  if (forbiddenField) {
    throw new Error(`${forbiddenField} cannot be changed through the current-session correction tool.`);
  }
  if (hasOwn(input, "name") && !name) {
    throw new Error("name cannot be empty.");
  }
  if (hasOwn(input, "priority") && !priority) {
    throw new Error("priority cannot be empty.");
  }
  if (hasOwn(input, "steps")) {
    if (!Array.isArray(steps) || !steps.length) {
      throw new Error("A complete non-empty final step list is required when updating steps.");
    }
    if (steps.some((step) => !step?.description || !step?.expectedResult)) {
      throw new Error("Every updated test step requires description and expectedResult.");
    }
  }

  const mutableFields = [
    "name",
    "objective",
    "precondition",
    "priority",
    "labels",
    "customFields",
    "steps"
  ];
  if (!mutableFields.some((field) => hasOwn(input, field))) {
    throw new Error("At least one editable field is required.");
  }

  const payload = {
    ...(hasOwn(input, "name") ? { name } : {}),
    ...(hasOwn(input, "objective") ? { objective: objective ? toTmsRichText(objective) : objective } : {}),
    ...(hasOwn(input, "precondition") ? { precondition: precondition ? toTmsRichText(precondition) : precondition } : {}),
    ...(hasOwn(input, "priority") ? { priority } : {}),
    ...(hasOwn(input, "labels") ? { labels } : {}),
    ...(hasOwn(input, "customFields") ? { customFields } : {}),
    ...(hasOwn(input, "steps") ? {
      testScript: {
        type: "STEP_BY_STEP",
        steps: steps.map(normalizeTestStep)
      }
    } : {})
  };

  const result = await zephyrRequest(
    `/rest/atm/1.0/testcase/${encodeURIComponent(testCaseKey)}`,
    "PUT",
    payload
  );
  return withTestCaseWebUrl({
    ...result,
    key: result?.key || testCaseKey
  }, testCaseKey);
}

async function zephyrUpdateTestCase(input) {
  const { confirmed, testCaseKey, expectedBaselineHash, ...changes } = input;
  if (confirmed !== true) {
    throw new Error("Explicit user confirmation is required to update an existing test case.");
  }
  if (!testCaseKey || !expectedBaselineHash) {
    throw new Error("testCaseKey and expectedBaselineHash from a complete baseline read are required.");
  }

  const current = await zephyrGetTestCase({ testCaseKey });
  if (current?._testdocs?.complete !== true || !current._testdocs.contentHash) {
    throw new Error("Existing-case update requires a complete direct baseline read; metadata-only content is unsafe.");
  }
  if (current._testdocs.contentHash !== expectedBaselineHash) {
    const error = new Error(
      `STALE_PROPOSAL: Test case ${testCaseKey} changed after the proposal baseline was read. No update was applied.`
    );
    error.code = "STALE_PROPOSAL";
    throw error;
  }

  const result = await zephyrUpdateSessionTestCase({
    confirmed: true,
    testCaseKey,
    ...changes
  });
  return {
    ...result,
    _testdocs: {
      ...(result?._testdocs || {}),
      baselineVerified: true,
      changedFields: Object.keys(changes)
    }
  };
}

module.exports = {
  jiraRequest,
  zephyrRequest,
  tools: {
    get_issue: getIssue,
    add_comment: addComment,
    jira_publish_checklist_comment: publishChecklistComment,
    transition_issue: transitionIssue,
    get_transitions: getTransitions,
    search_issues: searchIssues,
    // Zephyr tools
    zephyr_get_projects: zephyrGetProjects,
    zephyr_get_project: zephyrGetProject,
    zephyr_search_test_cases: zephyrSearchTestCases,
     zephyr_get_test_plans: zephyrGetTestPlans,
     zephyr_get_test_plan: zephyrGetTestPlan,
     zephyr_get_iterations: zephyrGetIterations,
     zephyr_get_test_case: zephyrGetTestCase,
     zephyr_get_all_test_cases: zephyrGetAllTestCases,
     zephyr_create_test_case: zephyrCreateTestCase,
     zephyr_update_session_test_case: zephyrUpdateSessionTestCase,
     zephyr_update_test_case: zephyrUpdateTestCase
  },
  jiraWikiChecklistToAdf
};
