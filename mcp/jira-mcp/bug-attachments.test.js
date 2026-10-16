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

async function fixture(t, failure, files = [{ filename: "screen.png", mimeType: "image/png", data: Buffer.from([137, 80, 78, 71]) }]) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "bug-evidence-"));
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  for (const file of files) await fs.writeFile(path.join(dir, file.localFilename || file.filename), file.data);
  const input = { confirmed: true, projectKey: "DEMO", issueTypeId: "1", summary: "FE. Button is hidden", description: "Context", descriptionFormat: "wiki", additionalFields: { customfield_1: "1. Open page", customfield_2: "Hidden", customfield_3: "Visible" }, attachments: files.map((file) => ({ path: path.join(dir, file.localFilename || file.filename), filename: file.filename, mimeType: file.mimeType })) };
  const calls = [];
  let description = input.description;
  const uploaded = [];
  t.mock.method(global, "fetch", async (url, options) => {
    calls.push({ url, options });
    let data;
    if (url.endsWith("/attachment/meta")) data = { enabled: failure !== "disabled", uploadLimit: 1000 };
    else if (url.endsWith("/myself")) data = { name: "tester" };
    else if (url.endsWith("/attachments")) {
      if (failure === "upload" || (failure === "second_upload" && uploaded.length === 1)) throw new Error("Connection lost");
      assert(options.body instanceof FormData);
      assert.equal(options.headers["X-Atlassian-Token"], "no-check");
      assert.equal(options.headers["Content-Type"], undefined);
      const blob = options.body.get("file");
      const file = files[uploaded.length];
      assert.equal(blob.name, file.filename);
      assert.deepEqual(Buffer.from(await blob.arrayBuffer()), file.data);
      const id = String(71 + uploaded.length);
      const attachment = { id, filename: file.filename, mimeType: file.mimeType, content: `https://jira.example.test/secure/attachment/${id}/${file.filename}` };
      uploaded.push(attachment);
      data = [attachment];
    } else if (options.method === "POST") data = { key: "DEMO-1" };
    else if (options.method === "PUT") {
      if (failure === "preview") throw new Error("Preview update failed");
      description = JSON.parse(options.body).fields.description; data = {};
    }
    else data = { fields: { description: failure === "concurrent" ? "Human edit" : description, attachment: failure === "renamed" ? uploaded.map((file) => ({ ...file, filename: "unexpected.png" })) : uploaded } };
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
  assert(!update.fields.description.includes("/secure/attachment/"));
});

test("each image uses its uploaded name and each other file a native attachment link", async (t) => {
  const files = [
    { filename: "03-android-listing-not-rendered.png", localFilename: "clipboard.png", mimeType: "image/png", data: Buffer.from([137, 80, 78, 71]) },
    { filename: "expected.jpg", mimeType: "image/jpeg", data: Buffer.from([255, 216, 255]) },
    { filename: "server.log", mimeType: "text/plain", data: Buffer.from("Original log\r\n") },
    { filename: "reproduction.mp4", mimeType: "video/mp4", data: Buffer.from("original recording") },
    { filename: "diagnostics.zip", mimeType: "application/zip", data: Buffer.from("original archive") },
    { filename: "requirements.pdf", mimeType: "application/pdf", data: Buffer.from("original document") }
  ];
  const { input, calls } = await fixture(t, undefined, files);
  const result = await tools.jira_create_bug(input);
  assert.equal(result._testdocs.previews, "wiki_thumbnails_inserted");
  assert.equal(result._testdocs.attachments.length, files.length);
  assert(result._testdocs.attachments.every((file) => file.status === "uploaded"));
  const update = JSON.parse(calls.find((c) => c.options.method === "PUT").options.body);
  assert.equal(update.fields.description, "Context\n\nМатериалы:\n\n03-android-listing-not-rendered.png\n!03-android-listing-not-rendered.png|thumbnail!\n\nexpected.jpg\n!expected.jpg|thumbnail!\n\n[^server.log]\n\n[^reproduction.mp4]\n\n[^diagnostics.zip]\n\n[^requirements.pdf]");
  assert.equal(calls.filter((c) => c.options.method === "POST" && c.url.endsWith("/issue")).length, 1);
});

test("missing or plain format cannot silently create a bug with attachment URLs", async (t) => {
  const { input, calls } = await fixture(t);
  for (const descriptionFormat of [undefined, "plain"]) {
    await assert.rejects(tools.jira_create_bug({ ...input, descriptionFormat }), /require descriptionFormat: "wiki"/);
  }
  assert.equal(calls.length, 0);
});

test("non-image evidence also requires Wiki format and reports only native file links", async (t) => {
  const { input, calls } = await fixture(t, undefined, [{ filename: "server.log", mimeType: "text/plain", data: Buffer.from("Original log") }]);
  await assert.rejects(tools.jira_create_bug({ ...input, descriptionFormat: "plain" }), /require descriptionFormat: "wiki"/);
  assert.equal(calls.length, 0);
  const result = await tools.jira_create_bug(input);
  assert.equal(result._testdocs.previews, "attachment_links_inserted");
  assert.equal(JSON.parse(calls.find((c) => c.options.method === "PUT").options.body).fields.description, "Context\n\nМатериалы:\n\n[^server.log]");
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

test("partial uploads retain successful IDs and do not insert references to pending files", async (t) => {
  const files = ["first.png", "second.png", "third.png"].map((filename) => ({ filename, mimeType: "image/png", data: Buffer.from(filename) }));
  const { input, calls } = await fixture(t, "second_upload", files);
  const result = await tools.jira_create_bug(input);
  assert.equal(result.key, "DEMO-1");
  assert.deepEqual(result._testdocs.attachments.map((file) => file.status), ["uploaded", "failed_or_uncertain", "pending"]);
  assert.equal(result._testdocs.attachments[0].id, "71");
  assert.equal(result._testdocs.previews, "not_inserted");
  assert.equal(calls.filter((c) => c.options.method === "POST").length, 3);
  assert.equal(calls.filter((c) => c.options.method === "PUT").length, 0);
});

for (const failure of ["preview", "renamed"]) {
  test(`${failure} failure never claims that image references were verified`, async (t) => {
    const { input, calls } = await fixture(t, failure);
    const result = await tools.jira_create_bug(input);
    assert.equal(result.key, "DEMO-1");
    assert.equal(result._testdocs.partialFailure, true);
    assert.equal(result._testdocs.previews, "failed_or_unverified");
    assert.equal(result._testdocs.attachments[0].id, "71");
    assert.equal(calls.filter((c) => c.options.method === "PUT").length, 1);
    assert.equal(calls.filter((c) => c.options.method === "POST" && c.url.endsWith("/issue")).length, 1);
  });
}

test("missing prefix and missing authorization cannot write", async (t) => {
  const { input, calls } = await fixture(t);
  await assert.rejects(tools.jira_create_bug({ ...input, summary: "Button is hidden" }), /summary must start/);
  await assert.rejects(tools.jira_create_bug({ ...input, confirmed: false }), /Explicit user intent/);
  assert.equal(calls.length, 0);
});
