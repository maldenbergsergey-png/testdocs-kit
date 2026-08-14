require("dotenv").config({ quiet: true });

const {
  JIRA_URL,
  JIRA_EMAIL,
  JIRA_TOKEN,
  JIRA_AUTH_MODE = "basic",
  JIRA_API_VERSION = "3",
  JIRA_INSECURE_TLS = "0"
} = process.env;

if (JIRA_INSECURE_TLS === "1") {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
}

function buildAuthHeader() {
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

async function jiraRequest(path, method = "GET", body) {
  if (!JIRA_URL) {
    throw new Error("JIRA_URL is required");
  }

  const url = `${JIRA_URL}${path}`;
  const res = await fetch(url, {
    method,
    headers: {
      Authorization: buildAuthHeader(),
      Accept: "application/json",
      "Content-Type": "application/json"
    },
    body: body ? JSON.stringify(body) : undefined
  });

  const contentType = res.headers.get("content-type") || "";
  const rawText = await res.text();
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
  const res = await fetch(url, {
    method,
    headers: {
      Authorization: buildAuthHeader(),
      Accept: "application/json",
      "Content-Type": "application/json"
    },
    body: body ? JSON.stringify(body) : undefined
  });

  const contentType = res.headers.get("content-type") || "";
  const rawText = await res.text();
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

    throw new Error(
      `Zephyr request failed (${res.status}) for ${url}. Body: ${details}`
    );
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

async function zephyrSearchTestCases({ projectId, fields, query, maxResults = 50, offset = 0 }) {
  // Note: Zephyr Scale API has a maximum effective maxResults of 1000
  // Beyond that, it returns empty results. Pagination via offset doesn't work reliably.
  // Also, 'fields' parameter is required by the API
  const effectiveMaxResults = Math.min(Math.max(maxResults, 1), 1000);
  const defaultFields = "id,key,name,objective,precondition,status,priority,createdOn,updatedOn";

  const params = new URLSearchParams();
  params.set("projectId", projectId);
  params.set("fields", fields || defaultFields);
  if (query) params.set("query", query);
  params.set("maxResults", String(effectiveMaxResults));
  params.set("offset", String(offset));
  return zephyrRequest(`/rest/tests/1.0/testcase/search?${params.toString()}`);
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

async function zephyrGetTestCase({ projectId, testCaseKey }) {
  // The direct GET /testcase/{key} endpoint returns 500
  // So we search for all test cases and find the one with matching key
  // Note: maxResults=1000 is the highest working value
  const result = await zephyrSearchTestCases({
    projectId,
    maxResults: 1000,
    fields: "id,key,name,objective,precondition,priority,status,createdOn,updatedOn,labels,priority,statusName"
  });

  const testCase = result.results?.find(tc => tc.key === testCaseKey);
  if (!testCase) {
    throw new Error(`Test case ${testCaseKey} not found in project ${projectId}`);
  }
  return testCase;
}

async function zephyrGetAllTestCases({ projectId, fields }) {
  // Get ALL test cases from a project (up to 1000 max from API)
  // Returns only the first 1000, but that covers most projects
  const result = await zephyrSearchTestCases({
    projectId,
    maxResults: 1000,
    fields: fields || "id,key,name,objective,precondition,status,priority,createdOn,updatedOn"
  });
  return result.results || [];
}

module.exports = {
  jiraRequest,
  zephyrRequest,
  tools: {
    get_issue: getIssue,
    add_comment: addComment,
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
     zephyr_get_all_test_cases: zephyrGetAllTestCases
  }
};
