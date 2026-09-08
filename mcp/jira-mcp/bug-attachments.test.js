const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");

process.env.JIRA_URL = "https://jira.example.test";
process.env.JIRA_TOKEN = "test-token";
process.env.JIRA_AUTH_MODE = "bearer";
process.env.JIRA_API_VERSION = "2";
const { tools } = require("./jira-client");

async function fixture(t, failure) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "bug-evidence-"));
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const filename = "screen.png";
  await fs.writeFile(path.join(dir, filename), Buffer.from([137, 80, 78, 71]));
  const input = { confirmed: true, projectKey: "DEMO", issueTypeId: "1", summary: "FE. Button is hidden", description: "Context", descriptionFormat: "wiki", additionalFields: { customfield_1: "1. Open page", customfield_2: "Hidden", customfield_3: "Visible" }, attachments: [{ path: path.join(dir, filename), mimeType: "image/png" }] };
  const calls = [];
  let description = input.description;
  const attachment = { id: "71", filename, mimeType: "image/png", content: "https://jira.example.test/attachment/71" };
  t.mock.method(global, "fetch", async (url, options) => {
    calls.push({ url, options });
    let data;
    if (url.endsWith("/attachment/meta")) data = { enabled: failure !== "disabled", uploadLimit: 1000 };
    else if (url.endsWith("/myself")) data = { name: "tester" };
    else if (url.endsWith("/attachments")) {
      if (failure === "upload") throw new Error("Connection lost");
      assert(options.body instanceof FormData);
      assert.equal(options.headers["X-Atlassian-Token"], "no-check");
      assert.equal(options.headers["Content-Type"], undefined);
      assert.equal(options.body.get("file").name, filename);
      data = [attachment];
    } else if (options.method === "POST") data = { key: "DEMO-1" };
    else if (options.method === "PUT") { description = JSON.parse(options.body).fields.description; data = {}; }
    else data = { fields: { description: failure === "concurrent" ? "Human edit" : description, attachment: [attachment] } };
    return { ok: true, status: 200, headers: { get: () => "application/json" }, text: async () => JSON.stringify(data) };
  });
  return { input, calls };
}

test("bug uploads supplied bytes and inserts verified Wiki thumbnails without moving dedicated fields", async (t) => {
  const { input, calls } = await fixture(t);
  const result = await tools.jira_create_bug(input);
  assert.equal(result._testdocs.previews, "wiki_thumbnails_inserted");
  assert.equal(result._testdocs.attachments[0].id, "71");
  const create = JSON.parse(calls.find((c) => c.url.endsWith("/issue")).options.body);
  assert.equal(create.fields.description, "Context");
  assert.equal(create.fields.customfield_3, "Visible");
  const update = JSON.parse(calls.find((c) => c.options.method === "PUT").options.body);
  assert.deepEqual(Object.keys(update.fields), ["description"]);
  assert.match(update.fields.description, /!screen.png\|thumbnail!/);
});

test("upload uncertainty preserves the created issue and never repeats creation or upload", async (t) => {
  const { input, calls } = await fixture(t, "upload");
  const result = await tools.jira_create_bug(input);
  assert.equal(result.key, "DEMO-1");
  assert.equal(result._testdocs.partialFailure, true);
  assert.equal(result._testdocs.attachments[0].status, "failed_or_uncertain");
  assert.equal(calls.filter((c) => c.options.method === "POST").length, 2);
  assert.equal(calls.filter((c) => c.options.method === "PUT").length, 0);
});

test("disabled attachments fail preflight before issue creation", async (t) => {
  const { input, calls } = await fixture(t, "disabled");
  await assert.rejects(tools.jira_create_bug(input), /attachments are disabled/);
  assert.equal(calls.filter((c) => c.options.method === "POST").length, 0);
});

test("concurrent Description edit is preserved and uploaded IDs remain available", async (t) => {
  const { input, calls } = await fixture(t, "concurrent");
  const result = await tools.jira_create_bug(input);
  assert.equal(result._testdocs.attachments[0].id, "71");
  assert.equal(result._testdocs.partialFailure, true);
  assert.equal(calls.filter((c) => c.options.method === "PUT").length, 0);
});

test("missing prefix and missing authorization cannot write", async (t) => {
  const { input, calls } = await fixture(t);
  await assert.rejects(tools.jira_create_bug({ ...input, summary: "Button is hidden" }), /summary must start/);
  await assert.rejects(tools.jira_create_bug({ ...input, confirmed: false }), /Explicit user intent/);
  assert.equal(calls.length, 0);
});
