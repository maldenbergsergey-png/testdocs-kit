const test = require("node:test");
const assert = require("node:assert/strict");

process.env.QA_REPORT_URL = "https://qa-report.example.test";
const { qaReportImportChecklist } = require("./qa-report-client");

function response(status, value) {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(value)
  };
}

test("QA Report import sends the documented payload and returns an external editor URL", async (t) => {
  let request;
  t.mock.method(global, "fetch", async (url, options) => {
    request = { url: String(url), options };
    return response(201, {
      ok: true,
      checklistId: "ec8d6464-70e0-4c84-ba6e-31fbd7fd1c9f",
      publicId: "851a9bd2",
      url: "https://qa-report.company.test/report/851a9bd2?importToken=ec8d6464-70e0-4c84-ba6e-31fbd7fd1c9f",
      expiresAt: 1783285561851,
      parsed: { sections: 1, rows: 1 }
    });
  });
  const result = await qaReportImportChecklist({
    confirmed: true,
    title: "Экспорт",
    issueUrl: "https://jira.example.test/browse/DEMO-123",
    content: "h2. Экспорт\n||Номер||Проверка||Статус||\n|1.|Экспорт файла| |"
  });
  assert.equal(request.url, "https://qa-report.example.test/api/checklists/import");
  assert.deepEqual(JSON.parse(request.options.body), {
    source: "testdocs-kit",
    format: "jira",
    title: "Экспорт",
    issueKey: "https://jira.example.test/browse/DEMO-123",
    content: "h2. Экспорт\n||Номер||Проверка||Статус||\n|1.|Экспорт файла| |"
  });
  assert.equal(result.openMode, "external_browser_tab");
  assert.match(result.url, /^https:\/\/qa-report\.company\.test\/report\//);
});

test("QA Report import requires explicit confirmation", async (t) => {
  const fetchMock = t.mock.method(global, "fetch", async () => response(201, {}));
  await assert.rejects(
    qaReportImportChecklist({ content: "||Номер||Проверка||\n|1.|Не отправлять|" }),
    /Explicit user confirmation/
  );
  assert.equal(fetchMock.mock.callCount(), 0);
});
