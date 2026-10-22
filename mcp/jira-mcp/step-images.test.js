const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { addStepImage, readStepAttachments } = require("./step-images");

const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a7WQAAAAASUVORK5CYII=", "base64");
function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "testdocs-step-images-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const imagePath = path.join(root, "Макет - Профиль.png");
  fs.writeFileSync(imagePath, png);
  return { confirmed: true, testCaseKey: "DEMO-T2", stepIndex: 0, expectedContentHash: "current", imagePath, targetField: "expectedResult", caption: "Макет - профиль" };
}
const baseScript = { type: "STEP_BY_STEP", steps: [{ id: 10, index: 0, description: "Save name", testData: "Name: Анна", expectedResult: "Name saved" }] };
const current = async () => ({ _testdocs: { complete: true, contentHash: "current" }, testScript: structuredClone(baseScript) });

test("image upload inserts a clickable thumbnail in the selected cell and preserves all other text", async (t) => {
  for (const targetField of ["description", "expectedResult"]) {
    const input = { ...fixture(t), targetField, caption: 'Макет - "Профиль"' };
    const calls = [];
    const attachmentPath = "/rest/atm/1.0/testcase/DEMO-T2/attachments";
    const saved = { id: 123, filename: path.basename(input.imagePath), filesize: png.length, url: "https://jira.example.test/attachment/123" };
    let uploaded = false;
    let script = structuredClone(baseScript);
    const result = await addStepImage(input, async (url, method = "GET", body, multipart) => {
      calls.push({ url, method });
      if (method === "POST") {
        assert.equal(url, attachmentPath);
        assert.equal(multipart, true);
        assert.equal(body.get("file").type, "image/png");
        assert.equal(body.get("file").name, saved.filename);
        assert.deepEqual(Buffer.from(await body.get("file").arrayBuffer()), png);
        uploaded = true;
        return { id: "123" };
      }
      if (method === "PUT") {
        assert.equal(url, "/rest/atm/1.0/testcase/DEMO-T2");
        assert.deepEqual(Object.keys(body), ["testScript"]);
        script = body.testScript;
        return {};
      }
      return url === attachmentPath && uploaded ? [saved] : [];
    }, async () => ({ _testdocs: { complete: true, contentHash: "current" }, testScript: structuredClone(script) }));
    assert.deepEqual(calls.map(({ method }) => method), ["GET", "GET", "POST", "GET", "PUT"]);
    assert.equal(result.status, "preview_saved");
    assert.equal(result.id, "123");
    assert.equal(result.targetField, targetField);
    assert.equal(result.url, saved.url);
    assert.equal(result.displayVerified, false);
    assert.match(result.sha256, /^[a-f0-9]{64}$/);
    assert.equal(script.steps[0].id, 10);
    assert.equal(script.steps[0].testData, baseScript.steps[0].testData);
    const otherField = targetField === "description" ? "expectedResult" : "description";
    assert.equal(script.steps[0][otherField], baseScript.steps[0][otherField]);
    assert(script.steps[0][targetField].startsWith(baseScript.steps[0][targetField] + "<br>"));
    assert.match(script.steps[0][targetField], /<a href="https:\/\/jira.example.test\/attachment\/123"><img/);
    assert.match(script.steps[0][targetField], /width="320"/);
    assert.match(script.steps[0][targetField], /&quot;Профиль&quot;/);
  }
});

test("invalid, unconfirmed, stale and wrong-step image requests never POST", async (t) => {
  const input = fixture(t);
  const request = async () => { throw new Error("Unexpected upload/inventory request"); };
  for (const change of [
    { confirmed: false }, { stepIndex: -1 }, { stepIndex: 0.5 },
    { expectedContentHash: "stale" }, { expectedContentHash: "" },
    { stepIndex: 1 }, { targetField: "testData" }, { caption: "" }, { thumbnailWidth: 500 }, { imagePath: "relative.png" }, { filename: "../unsafe.png" },
    { filename: "not-a-jpeg.jpg" }
  ]) await assert.rejects(() => addStepImage({ ...input, ...change }, request, current));
  fs.writeFileSync(input.imagePath, "not an image");
  await assert.rejects(() => addStepImage(input, request, current), /bytes do not match/);
});

test("metadata-only cases and unavailable inventories do not authorize image uploads", async (t) => {
  const input = fixture(t);
  await assert.rejects(() => addStepImage(input, async () => assert.fail("network"), async () => ({ _testdocs: { complete: false } })), /unavailable or changed/);
  await assert.rejects(() => addStepImage(input, async () => ({}), current), /inventory is unavailable/);
  await assert.rejects(() => readStepAttachments({ ...input, stepIndex: "0" }, async () => []), /exact non-negative/);
});

test("native attachments prevent a script replacement that could lose their binding", async (t) => {
  const input = fixture(t);
  let calls = 0;
  await assert.rejects(() => addStepImage(input, async (_url, method = "GET") => {
    calls++;
    assert.equal(method, "GET");
    return [{ id: 1, filename: path.basename(input.imagePath) }];
  }, current), /Native step attachments/);
  assert.equal(calls, 1);
});

test("uncertain POSTs return a recoverable partial state and never retry", async (t) => {
  const input = fixture(t);
  let posts = 0;
  const result = await addStepImage(input, async (_url, method = "GET") => {
    if (method === "POST") { posts++; throw new Error("connection closed after upload"); }
    return [];
  }, current);
  assert.equal(posts, 1);
  assert.equal(result.status, "failed_or_uncertain");
  assert.equal(result.partialFailure, true);
  assert.equal(result.testCaseKey, input.testCaseKey);
  assert.match(result.nextAction, /before retrying/);
});

test("duplicate case source names stop before POST", async (t) => {
  const input = fixture(t);
  await assert.rejects(() => addStepImage(input, async (url, method = "GET") => {
    assert.equal(method, "GET");
    return url.includes("/step/") ? [] : [{ id: 1, filename: path.basename(input.imagePath) }];
  }, current), /already exists/);
});

test("concurrent script changes after source upload are preserved", async (t) => {
  const input = fixture(t);
  let uploaded = false;
  let reads = 0;
  const result = await addStepImage(input, async (url, method = "GET") => {
    assert.notEqual(method, "PUT");
    if (method === "POST") { uploaded = true; return { id: 123 }; }
    return uploaded && !url.includes("/step/") ? [{ id: 123, filename: path.basename(input.imagePath), filesize: png.length, url: "https://jira.example.test/attachment/123" }] : [];
  }, async () => {
    const value = await current();
    if (++reads > 1) value.testScript.steps[0].description = "Concurrent change";
    return value;
  });
  assert.equal(result.status, "source_uploaded");
  assert.equal(result.id, "123");
  assert.equal(result.partialFailure, true);
  assert.match(result.error, /Script changed/);
});

test("stripped preview markup or an uncertain script PUT never counts as saved", async (t) => {
  const input = fixture(t);
  for (const failPut of [true, false]) {
    let uploaded = false;
    let puts = 0;
    const result = await addStepImage(input, async (url, method = "GET") => {
      if (method === "POST") { uploaded = true; return { id: 123 }; }
      if (method === "PUT") {
        puts++;
        if (failPut) throw new Error("connection closed after PUT");
        return {};
      }
      return uploaded && !url.includes("/step/") ? [{ id: 123, filename: path.basename(input.imagePath), filesize: png.length, url: "https://jira.example.test/attachment/123" }] : [];
    }, current);
    assert.equal(result.status, "preview_write_uncertain");
    assert.equal(result.partialFailure, true);
    assert.equal(result.id, "123");
    assert.equal(puts, 1);
  }
});

test("wrong source attachment metadata never counts as a saved preview", async (t) => {
  const input = fixture(t);
  for (const change of [null, { filename: "other.png" }, { filesize: 1 }, { url: null }, { id: 999 }]) {
    let reads = 0;
    const result = await addStepImage(input, async (_url, method = "GET") => {
      if (method === "POST") return { id: 123 };
      if (++reads <= 2 || change === null) return [];
      return [{ id: 123, filename: path.basename(input.imagePath), filesize: png.length, url: "https://jira.example.test/attachment/123", ...change }];
    }, current);
    assert.equal(result.status, "uploaded_unverified");
    assert.equal(result.id, "123");
    assert.equal(result.partialFailure, true);
  }
});

test("Zephyr transport sends multipart without overriding its boundary", async (t) => {
  process.env.JIRA_URL = "https://jira.example.test";
  process.env.JIRA_AUTH_MODE = "basic";
  process.env.JIRA_EMAIL = "tester";
  process.env.JIRA_TOKEN = "test-only";
  const { zephyrRequest } = require("./jira-client");
  const form = new FormData();
  form.append("file", new Blob([png], { type: "image/png" }), "profile.png");
  t.mock.method(global, "fetch", async (url, options) => {
    assert.equal(String(url), "https://jira.example.test/rest/atm/1.0/testcase/DEMO-T2/step/0/attachments");
    assert.equal(options.method, "POST");
    assert.equal(options.headers["Content-Type"], undefined);
    assert.equal(options.headers.Accept, "application/json");
    assert.match(options.headers.Authorization, /^Basic /);
    assert.deepEqual(Buffer.from(await options.body.get("file").arrayBuffer()), png);
    return { ok: true, status: 201, headers: { get: () => "application/json" }, text: async () => '{"id":"123"}' };
  });
  assert.deepEqual(await zephyrRequest("/rest/atm/1.0/testcase/DEMO-T2/step/0/attachments", "POST", form, true), { id: "123" });
});
