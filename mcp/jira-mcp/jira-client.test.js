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
  assert.equal(result._testdocs.webUrl, "https://jira.example.test/secure/Tests.jspa#/testCase/DEMO-T7");
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
  assert.equal(result._testdocs.webUrl, "https://jira.example.test/secure/Tests.jspa#/testCase/DEMO-T8");
});

test("zephyr_get_test_case does not hide permission errors", async (t) => {
  const fetchMock = t.mock.method(global, "fetch", async () => response(403, { message: "Forbidden" }));

  await assert.rejects(
    tools.zephyr_get_test_case({ projectId: "10000", testCaseKey: "DEMO-T9" }),
    (error) => error.status === 403,
  );
  assert.equal(fetchMock.mock.callCount(), 1);
});

test("zephyr_create_test_case sends step-level test data to the public Server API", async (t) => {
  let request;
  t.mock.method(global, "fetch", async (url, options) => {
    request = { url: String(url), options };
    return response(201, { key: "DEMO-T10" });
  });

  const result = await tools.zephyr_create_test_case({
    confirmed: true,
    projectKey: "DEMO",
    folder: "/Regression",
    name: "Создание объекта",
    objective: "Проверить создание объекта.",
    precondition: "Пользователь авторизован.",
    labels: ["block", "web"],
    issueLinks: ["DEMO-10"],
    steps: [
      {
        description: "Заполнить поля:\n• «Название»\n• «Сортировка»",
        testData: "• Название: Тестовый объект\n• Сортировка: 501",
        expectedResult: "• Значения отображаются в соответствующих полях\n• Флаг «Активность» установлен"
      },
      {
        description: "Нажать «Сохранить».",
        testData: "Не требуются",
        expectedResult: "Объект отображается в списке."
      }
    ]
  });

  assert.equal(request.url, "https://jira.example.test/rest/atm/1.0/testcase");
  assert.equal(request.options.method, "POST");
  assert.deepEqual(JSON.parse(request.options.body), {
    projectKey: "DEMO",
    folder: "/Regression",
    name: "Создание объекта",
    objective: "Проверить создание объекта.",
    precondition: "Пользователь авторизован.",
    labels: ["block", "web"],
    issueLinks: ["DEMO-10"],
    testScript: {
      type: "STEP_BY_STEP",
      steps: [
        {
          description: "Заполнить поля:<br>• «Название»<br>• «Сортировка»",
          testData: "• Название: Тестовый объект<br>• Сортировка: 501",
          expectedResult: "• Значения отображаются в соответствующих полях<br>• Флаг «Активность» установлен"
        },
        {
          description: "Нажать «Сохранить».",
          expectedResult: "Объект отображается в списке."
        }
      ]
    }
  });
  assert.equal(result.key, "DEMO-T10");
  assert.equal(result._testdocs.webUrl, "https://jira.example.test/secure/Tests.jspa#/testCase/DEMO-T10");
});

test("zephyr_create_test_case rejects a call without explicit confirmation", async () => {
  await assert.rejects(
    tools.zephyr_create_test_case({
      projectKey: "DEMO",
      folder: "/",
      name: "Не создавать",
      steps: [{ description: "Действие", expectedResult: "Результат" }]
    }),
    /Explicit user confirmation/
  );
});

test("zephyr_create_test_case rejects incomplete steps before any request", async (t) => {
  const fetchMock = t.mock.method(global, "fetch", async () => response(201, { key: "UNEXPECTED-T1" }));
  await assert.rejects(
    tools.zephyr_create_test_case({
      confirmed: true,
      projectKey: "DEMO",
      folder: "/",
      name: "Неполный кейс",
      steps: [{ description: "Действие без результата" }]
    }),
    /Every test step requires/
  );
  assert.equal(fetchMock.mock.callCount(), 0);
});

test("zephyr_update_session_test_case sends only requested fields and a complete final step list", async (t) => {
  let request;
  t.mock.method(global, "fetch", async (url, options) => {
    request = { url: String(url), options };
    return response(200, { key: "DEMO-T10" });
  });

  const result = await tools.zephyr_update_session_test_case({
    confirmed: true,
    testCaseKey: "DEMO-T10",
    objective: "",
    labels: [],
    steps: [
      {
        description: "Открыть форму.",
        testData: "Не требуется",
        expectedResult: "Форма открывается."
      },
      {
        description: "Ввести новое название.",
        testData: "Исправленный объект",
        expectedResult: "Новое название отображается в поле."
      }
    ]
  });

  assert.equal(request.url, "https://jira.example.test/rest/atm/1.0/testcase/DEMO-T10");
  assert.equal(request.options.method, "PUT");
  assert.deepEqual(JSON.parse(request.options.body), {
    objective: "",
    labels: [],
    testScript: {
      type: "STEP_BY_STEP",
      steps: [
        {
          description: "Открыть форму.",
          expectedResult: "Форма открывается."
        },
        {
          description: "Ввести новое название.",
          testData: "Исправленный объект",
          expectedResult: "Новое название отображается в поле."
        }
      ]
    }
  });
  assert.equal(result.key, "DEMO-T10");
  assert.equal(result._testdocs.webUrl, "https://jira.example.test/secure/Tests.jspa#/testCase/DEMO-T10");
});

test("zephyr_update_session_test_case rejects empty or unconfirmed updates", async (t) => {
  const fetchMock = t.mock.method(global, "fetch", async () => response(200, { key: "UNEXPECTED-T1" }));

  await assert.rejects(
    tools.zephyr_update_session_test_case({
      testCaseKey: "DEMO-T10",
      name: "Новое название"
    }),
    /Explicit user confirmation/
  );
  await assert.rejects(
    tools.zephyr_update_session_test_case({
      confirmed: true,
      testCaseKey: "DEMO-T10"
    }),
    /At least one editable field/
  );
  await assert.rejects(
    tools.zephyr_update_session_test_case({
      confirmed: true,
      testCaseKey: "DEMO-T10",
      steps: []
    }),
    /complete non-empty final step list/
  );
  await assert.rejects(
    tools.zephyr_update_session_test_case({
      confirmed: true,
      testCaseKey: "DEMO-T10",
      status: "Approved"
    }),
    /status cannot be changed/
  );
  assert.equal(fetchMock.mock.callCount(), 0);
});

test("zephyr_update_session_test_case accepts the official empty success response", async (t) => {
  t.mock.method(global, "fetch", async () => response(200, "", "text/plain"));

  const result = await tools.zephyr_update_session_test_case({
    confirmed: true,
    testCaseKey: "DEMO-T10",
    name: "Исправленное название"
  });

  assert.equal(result.key, "DEMO-T10");
  assert.equal(result._testdocs.webUrl, "https://jira.example.test/secure/Tests.jspa#/testCase/DEMO-T10");
});

test("zephyr_search_test_cases uses the ATM endpoint directly when projectKey is known", async (t) => {
  const calls = [];
  t.mock.method(global, "fetch", async (url) => {
    calls.push(String(url));
    return response(200, [{ key: "DEMO-T11", name: "FAQ" }]);
  });

  const result = await tools.zephyr_search_test_cases({ projectKey: "DEMO", maxResults: 3 });

  assert.equal(calls.length, 1);
  assert.match(calls[0], /^https:\/\/jira\.example\.test\/rest\/atm\/1\.0\/testcase\/search\?/);
  assert.match(calls[0], /query=projectKey\+%3D\+%22DEMO%22/);
  assert.equal(result.results[0]._testdocs.webUrl, "https://jira.example.test/secure/Tests.jspa#/testCase/DEMO-T11");
});

test("zephyr_search_test_cases recovers a compatible endpoint inside one tool call", async (t) => {
  const calls = [];
  t.mock.method(global, "fetch", async (url) => {
    calls.push(String(url));
    if (calls.length === 1) return response(400, { message: "Unsupported endpoint" });
    if (calls.length === 2) return response(200, { key: "DEMO" });
    return response(200, [{ key: "DEMO-T12", name: "Recovered" }]);
  });

  const result = await tools.zephyr_search_test_cases({ projectId: "10000", maxResults: 3 });

  assert.equal(calls.length, 3);
  assert.match(calls[0], /\/rest\/tests\/1\.0\/testcase\/search\?/);
  assert.equal(calls[1], "https://jira.example.test/rest/tests/1.0/project/10000");
  assert.match(calls[2], /\/rest\/atm\/1\.0\/testcase\/search\?/);
  assert.equal(result.results[0].key, "DEMO-T12");
});
