const test = require("node:test");
const assert = require("node:assert/strict");

process.env.JIRA_URL = "https://cloud.example.test";
process.env.JIRA_EMAIL = "tester@example.test";
process.env.JIRA_TOKEN = "not-a-real-secret";
process.env.JIRA_AUTH_MODE = "basic";
process.env.JIRA_API_VERSION = "3";

const { tools } = require("./jira-client");

function response(status, value) {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 || status === 201 ? "OK" : "Error",
    headers: { get: () => "application/json" },
    text: async () => JSON.stringify(value)
  };
}

test("Jira Cloud metadata uses project and issue-type endpoints", async (t) => {
  const calls = [];
  t.mock.method(global, "fetch", async (url) => {
    calls.push(String(url));
    if (String(url).endsWith("/myself")) return response(200, { accountId: "abc", displayName: "QA" });
    if (String(url).includes("/issuetypes/10001?")) {
      return response(200, {
        fields: [
          { fieldId: "summary", name: "Summary", required: true },
          { fieldId: "customfield_123", name: "Actual result", required: false }
        ]
      });
    }
    return response(200, {
      issueTypes: [{ id: "10001", name: "Bug", subtask: false }]
    });
  });

  const result = await tools.jira_get_bug_create_metadata({
    projectKey: "DEMO",
    issueTypeId: "10001"
  });

  assert.equal(calls.length, 3);
  assert(calls.some((url) => url.includes("/createmeta/DEMO/issuetypes?")));
  assert(calls.some((url) => url.includes("/createmeta/DEMO/issuetypes/10001?")));
  assert.equal(result.project.issuetypes[0].fields.customfield_123.name, "Actual result");
});

test("Jira Cloud bug creation uses ADF and accountId", async (t) => {
  const requests = [];
  t.mock.method(global, "fetch", async (url, options) => {
    requests.push({ url: String(url), options });
    if (String(url).endsWith("/myself")) return response(200, { accountId: "abc", displayName: "QA" });
    return response(201, { key: "DEMO-7" });
  });

  await tools.jira_create_bug({
    confirmed: true,
    projectKey: "DEMO",
    issueTypeId: "10001",
    summary: "BE. Broken total",
    description: "Actual result:\nWrong total"
  });

  const payload = JSON.parse(requests[1].options.body);
  assert.deepEqual(payload.fields.assignee, { accountId: "abc" });
  assert.equal(payload.fields.description.type, "doc");
  assert.equal(payload.fields.description.content[1].content[0].text, "Wrong total");
});

test("Jira Cloud reads later metadata pages containing optional result fields", async (t) => {
  t.mock.method(global, "fetch", async (url) => {
    if (url.endsWith("/myself")) return response(200, { accountId: "abc" });
    if (url.includes("/issuetypes/10001?")) {
      return response(200, url.includes("startAt=1")
        ? { values: [{ fieldId: "customfield_9", name: "Expected result", required: false }], isLast: true }
        : { values: [{ fieldId: "summary", name: "Summary" }], isLast: false });
    }
    return response(200, url.includes("startAt=1")
      ? { values: [{ id: "10001", name: "Bug" }], isLast: true }
      : { values: [{ id: "10000", name: "Task" }], isLast: false });
  });
  const result = await tools.jira_get_bug_create_metadata({ projectKey: "DEMO", issueTypeId: "10001" });
  assert.equal(result.project.issuetypes[1].fields.customfield_9.name, "Expected result");
});

test("Cloud attachment completion uses real links and explicitly reports missing media previews", async () => {
  const { finishBugAttachments } = require("./bug-attachments");
  const file = { filename: "screen.png", mimeType: "image/png", data: Buffer.from("image") };
  const attachment = { id: "123", filename: file.filename, mimeType: file.mimeType, content: "https://cloud.example.test/attachment/123" };
  let description = null;
  const request = async (url, method, body) => {
    if (url.endsWith("/attachments")) return [attachment];
    if (method === "PUT") { description = body.fields.description; return {}; }
    return { fields: { description, attachment: [attachment] } };
  };
  const toAdf = () => ({ version: 1, type: "doc", content: [] });
  const result = await finishBugAttachments({}, { key: "DEMO-1", _testdocs: {} }, [file], request, "3", toAdf);
  assert.equal(result._testdocs.previews, "links_only");
  assert.match(result._testdocs.previewLimitation, /inline previews/);
  assert.equal(description.content[1].content[0].marks[0].attrs.href, attachment.content);
  assert(!JSON.stringify(description).includes('"type":"media"'));
});
