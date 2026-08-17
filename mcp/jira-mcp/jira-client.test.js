const test = require("node:test");
const assert = require("node:assert/strict");

process.env.JIRA_URL = "https://jira.example.test";
process.env.JIRA_EMAIL = "tester@example.test";
process.env.JIRA_TOKEN = "not-a-real-secret";
process.env.JIRA_AUTH_MODE = "basic";

const { tools } = require("./jira-client");

function response(status, value, contentType = "application/json") {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? "OK" : "Error",
    headers: { get: (name) => name.toLowerCase() === "content-type" ? contentType : null },
    text: async () => typeof value === "string" ? value : JSON.stringify(value)
  };
}

test("zephyr_get_test_case returns the complete ATM case with ordered steps", async (t) => {
  const calls = [];
  t.mock.method(global, "fetch", async (url) => {
    calls.push(String(url));
    return response(200, {
      key: "DEMO-T7",
      testScript: {
        type: "STEP_BY_STEP",
        steps: [
          { index: 2, description: "Третий шаг", expectedResult: "Результат 3" },
          { index: 0, description: "Первый шаг", expectedResult: "Результат 1" },
          { index: 1, description: "Второй шаг", expectedResult: "Результат 2" }
        ]
      }
    });
  });

  const result = await tools.zephyr_get_test_case({ projectId: "10000", testCaseKey: "DEMO-T7" });

  assert.equal(calls.length, 1);
  assert.equal(calls[0], "https://jira.example.test/rest/atm/1.0/testcase/DEMO-T7");
  assert.deepEqual(result.testScript.steps.map((step) => step.index), [0, 1, 2]);
  assert.equal(result.testScript.steps[0].expectedResult, "Результат 1");
});

test("zephyr_get_test_case marks a metadata-only fallback explicitly", async (t) => {
  const calls = [];
  t.mock.method(global, "fetch", async (url) => {
    calls.push(String(url));
    if (calls.length === 1) return response(404, { message: "Not found" });
    return response(200, { results: [{ key: "DEMO-T8", name: "Metadata case" }] });
  });

  const result = await tools.zephyr_get_test_case({ projectId: "10000", testCaseKey: "DEMO-T8" });

  assert.equal(calls.length, 2);
  assert.match(calls[1], /^https:\/\/jira\.example\.test\/rest\/tests\/1\.0\/testcase\/search\?/);
  assert.equal(result.key, "DEMO-T8");
  assert.equal(result._testdocs.complete, false);
  assert.match(result._testdocs.warning, /test steps are unavailable/);
});

test("zephyr_get_test_case does not hide permission errors", async (t) => {
  const fetchMock = t.mock.method(global, "fetch", async () => response(403, { message: "Forbidden" }));

  await assert.rejects(
    tools.zephyr_get_test_case({ projectId: "10000", testCaseKey: "DEMO-T9" }),
    (error) => error.status === 403,
  );
  assert.equal(fetchMock.mock.callCount(), 1);
});
