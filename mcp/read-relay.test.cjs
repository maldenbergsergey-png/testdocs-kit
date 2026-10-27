const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { readRelay, searchKnowledge, validateRelay } = require("./read-relay.cjs");
const { issueReference } = require("./issue-routing.cjs");
const { ConfluenceClient } = require("./confluence-mcp/dist/confluence.js");

function setup(t) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "testdocs-read-relay-"));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const tokenFile = path.join(directory, "credential");
  fs.writeFileSync(tokenFile, "fixture-relay-token", { mode: 0o600 });
  return { url: "https://gateway.example.test/relay/issues", tokenFile };
}
function response(value, status = 200) {
  return new Response(JSON.stringify(value), { status, headers: { "Content-Type": "application/json" } });
}
function jira(config, routes = []) {
  Object.assign(process.env, {
    JIRA_URL: "https://jira.example.test", JIRA_API_VERSION: "2", JIRA_EMAIL: "tester", JIRA_TOKEN: "fixture-write-password",
    JIRA_AUTH_MODE: "basic", JIRA_PASSWORD_SESSION: "0", JIRA_SP_SECRET: "", JIRA_CONNECTION_ID: "primary",
    JIRA_READ_RELAY_URL: config.url, JIRA_READ_RELAY_TOKEN_FILE: config.tokenFile,
    JIRA_READ_RELAY_FALLBACK: config.fallback || "none",
    JIRA_ISSUE_ROUTING: JSON.stringify(routes)
  });
  delete require.cache[require.resolve("./jira-mcp/jira-client.js")];
  return require("./jira-mcp/jira-client.js").tools;
}

test("relay reads fetch the current private key each time, use GET and stop redirects", async (t) => {
  const config = setup(t);
  const calls = [];
  t.mock.method(global, "fetch", async (url, options) => { calls.push({ url, ...options }); return response({ key: "DEMO-1" }); });
  await readRelay(config, "/rest/api/2/search", { jql: "project = DEMO" });
  fs.writeFileSync(config.tokenFile, "rotated-fixture-token");
  await readRelay(config, "/rest/api/2/issue/DEMO-1");
  assert.equal(calls[0].headers.Authorization, "Bearer fixture-relay-token");
  assert.equal(calls[1].headers.Authorization, "Bearer rotated-fixture-token");
  assert.equal(calls[0].method, "GET");
  assert.equal(calls[0].redirect, "manual");
  assert.equal(new URL(calls[0].url).searchParams.get("jql"), "project = DEMO");
  await assert.rejects(readRelay(config, "/rest/api/2/../issue"), /READ_RELAY_PATH/);
});

test("relay errors redact credentials and never call a different endpoint", async (t) => {
  const config = setup(t);
  const calls = [];
  t.mock.method(global, "fetch", async (url) => { calls.push(url); return response({ error: "fixture-relay-token" }, 403); });
  await assert.rejects(readRelay(config, "/rest/api/2/issue/DEMO-1"), (error) => /403/.test(error.message) && !error.message.includes("fixture-relay-token"));
  assert.equal(calls.length, 1);
  t.mock.method(global, "fetch", async () => new Response(null, { status: 302, headers: { Location: "https://jira.example.test/login" } }));
  await assert.rejects(readRelay(config, "/rest/api/2/issue/DEMO-1"), /302/);
  await assert.rejects(readRelay({ ...config, tokenFile: path.join(path.dirname(config.tokenFile), "absent") }, "/rest/api/2/issue/DEMO-1"), /READ_RELAY_AUTH/);
});

test("non-private files and unsafe relay endpoints fail before HTTP", async (t) => {
  const config = setup(t);
  t.mock.method(global, "fetch", () => assert.fail("No HTTP allowed"));
  for (const url of ["http://gateway.example.test", "https://user:secret@gateway.example.test", "https://gateway.example.test/?key=secret"]) {
    assert.throws(() => validateRelay({ ...config, url }), /READ_RELAY_CONFIG/);
  }
  if (process.platform !== "win32") {
    fs.chmodSync(config.tokenFile, 0o644);
    await assert.rejects(readRelay(config, "/rest/api/2/myself"), /READ_RELAY_AUTH/);
  }
});

test("Jira context and GET search use relay; metadata, creation, read-back and TMS keep original auth", async (t) => {
  const api = jira(setup(t));
  const calls = [];
  t.mock.method(global, "fetch", async (url, options) => {
    calls.push({ url: String(url), ...options });
    if (String(url).includes("/createmeta")) return response({ projects: [{ key: "DEMO", issuetypes: [] }] });
    if (String(url).endsWith("/myself")) return response({ name: "tester" });
    return response({ key: options.method === "POST" ? "DEMO-2" : "DEMO-1" });
  });
  await api.get_issue({ key: "DEMO-1" });
  await api.search_issues({ jql: "project = DEMO" });
  await api.jira_get_bug_create_metadata({ projectKey: "DEMO" });
  await api.jira_create_bug({ confirmed: true, projectKey: "DEMO", issueTypeId: "1", summary: "FE. Save fails" });
  await api.get_issue({ key: "DEMO-2" });
  await api.zephyr_get_projects();
  assert(calls.slice(0, 2).every((call) => call.url.startsWith("https://gateway.example.test/relay/issues/") && call.headers.Authorization === "Bearer fixture-relay-token" && call.method === "GET"));
  assert(calls.slice(2).every((call) => call.url.startsWith("https://jira.example.test/") && call.headers.Authorization.startsWith("Basic ")));
  assert.equal(calls.filter((call) => call.method === "POST").length, 1);
  assert(calls.some((call) => call.url === "https://jira.example.test/rest/api/2/issue/DEMO-2"));
});

test("Jira relay failure cannot bootstrap the original password session", async (t) => {
  const api = jira(setup(t));
  const calls = [];
  t.mock.method(global, "fetch", async (url) => { calls.push(String(url)); return response({}, 401); });
  await assert.rejects(api.get_issue({ key: "DEMO-1" }), /401/);
  assert.equal(calls.length, 1);
  assert(calls[0].startsWith("https://gateway.example.test/"));
});

test("instance routing rejects wrong and ambiguous keys before contacting either company", async (t) => {
  const routes = [
    { id: "primary", url: "https://jira.example.test", projectKeys: ["DEMO"] },
    { id: "other", url: "https://other.example.test/jira", projectKeys: ["OTHER"] }
  ];
  const api = jira(setup(t), routes);
  t.mock.method(global, "fetch", () => assert.fail("Wrong/ambiguous references must not reach HTTP"));
  await assert.rejects(api.get_issue({ key: "https://other.example.test/jira/browse/OTHER-1" }), /WRONG_CONNECTION/);
  await assert.rejects(api.get_issue({ key: "UNKNOWN-1" }), /AMBIGUOUS_INSTANCE/);
  assert.equal(issueReference("https://jira.example.test/browse/DEMO-1", routes[0], routes), "DEMO-1");
  assert.equal(issueReference("OTHER-1", routes[1], routes), "OTHER-1");
  assert.throws(() => issueReference("DEMO-1", routes[0], [...routes, { ...routes[1], projectKeys: ["DEMO"] }]), /AMBIGUOUS_INSTANCE/);
});

test("Confluence routes its reads through the relay while preserving canonical source links", async (t) => {
  const config = setup(t);
  const calls = [];
  t.mock.method(global, "fetch", async (url, options) => { calls.push({ url: String(url), ...options }); return response({ id: "42", title: "Requirements", body: { storage: { value: "Full text" } }, _links: { webui: "/pages/42" } }); });
  const client = new ConfluenceClient("https://wiki.example.test", "tester", "write-secret", "basic", undefined, "", true, config);
  const result = await client.getPage("42");
  assert.equal(result.url, "https://wiki.example.test/pages/42");
  assert.equal(result.body, "Full text");
  assert.equal(calls.length, 1);
  assert(calls[0].url.startsWith(`${config.url}/rest/api/content/42?`));
  assert.equal(calls[0].headers.Authorization, "Bearer fixture-relay-token");
});

test("semantic discovery uses only the configured same-origin POST endpoint", async (t) => {
  const config = { ...setup(t), knowledgeSearchUrl: "https://gateway.example.test/kb/search" };
  t.mock.method(global, "fetch", async (url, options) => {
    assert.equal(url, config.knowledgeSearchUrl);
    assert.equal(options.method, "POST");
    assert.deepEqual(JSON.parse(options.body), { question: "How to sign in?", top_k: 5 });
    return response({ hits: [{ title: "Sign in", text: "Snippet", source_url: "https://wiki.example.test/pages/42" }] });
  });
  assert.equal((await searchKnowledge(config, "How to sign in?")).hits.length, 1);
  assert.throws(() => validateRelay({ ...config, knowledgeSearchUrl: "https://other.example.test/kb/search" }), /same origin|origin/);
});

test("transient fallback reads only the same original Jira and reports its use", async (t) => {
  const config = { ...setup(t), fallback: "transient" };
  const api = jira(config);
  const calls = [];
  t.mock.method(global, "fetch", async (url, options) => {
    calls.push({ url: String(url), ...options });
    return String(url).startsWith(config.url) ? response({}, 503) : response({ issues: [{ key: "DEMO-1" }] });
  });
  const result = await api.search_issues({ jql: "project = DEMO" });
  assert.equal(result._testdocs.readTransport, "original_fallback");
  assert.equal(result._testdocs.primaryFailure, 503);
  assert.equal(calls.length, 2);
  assert(calls[1].url.startsWith("https://jira.example.test/rest/api/2/search?"));
  assert.equal(calls[1].method, "GET");
  assert.equal(calls[1].redirect, "manual");
  assert.equal(new URL(calls[1].url).searchParams.get("jql"), "project = DEMO");
  assert(calls[1].headers.Authorization.startsWith("Basic "));
});

test("fallback policy distinguishes auth, rate limits, redirects and invalid responses", async (t) => {
  const config = { ...setup(t), fallback: "transient" };
  let calls = 0;
  let status = 401;
  t.mock.method(global, "fetch", async (url) => { calls++; return String(url).startsWith(config.url) ? response({}, status) : response({ key: "DEMO-1" }); });
  const api = jira(config);
  for (status of [401, 403, 404, 429, 302]) {
    calls = 0;
    await assert.rejects(api.get_issue({ key: "DEMO-1" }));
    assert.equal(calls, 1);
  }
  assert.throws(() => validateRelay({ ...config, fallback: "transient_or_auth" }), /READ_RELAY_CONFIG/);
  calls = 0;
  t.mock.method(global, "fetch", async () => { calls++; return new Response("<html>Not JSON</html>"); });
  await assert.rejects(api.get_issue({ key: "DEMO-1" }), /READ_RELAY_RESPONSE/);
  assert.equal(calls, 1);
});

test("network fallback never bootstraps a password session or requests another login", async (t) => {
  const config = { ...setup(t), fallback: "transient" };
  jira(config);
  process.env.JIRA_PASSWORD_SESSION = "1";
  process.env.JIRA_SESSION_FILE = path.join(path.dirname(config.tokenFile), "absent-session.json");
  delete require.cache[require.resolve("./jira-mcp/jira-client.js")];
  const sessionApi = require("./jira-mcp/jira-client.js").tools;
  const calls = [];
  t.mock.method(global, "fetch", async (url) => { calls.push(String(url)); throw new Error("fixture network unavailable"); });
  await assert.rejects(sessionApi.get_issue({ key: "DEMO-1" }), /READ_FALLBACK_UNAVAILABLE/);
  assert.equal(calls.length, 1);
  assert(calls[0].startsWith(config.url));
  assert(!fs.existsSync(process.env.JIRA_SESSION_FILE));
});

test("password fallback reuses an existing cookie without sending the password", async (t) => {
  const config = { ...setup(t), fallback: "transient" };
  jira(config);
  process.env.JIRA_PASSWORD_SESSION = "1";
  process.env.JIRA_SESSION_FILE = path.join(path.dirname(config.tokenFile), "session.json");
  fs.writeFileSync(process.env.JIRA_SESSION_FILE, JSON.stringify({ service: "jira", baseUrl: "https://jira.example.test", cookies: [{ name: "session", value: "fixture-cookie", domain: "jira.example.test", path: "/" }] }), { mode: 0o600 });
  delete require.cache[require.resolve("./jira-mcp/jira-client.js")];
  const api = require("./jira-mcp/jira-client.js").tools;
  t.mock.method(global, "fetch", async (url, options) => {
    if (String(url).startsWith(config.url)) return response({}, 502);
    const headers = new Headers(options.headers);
    assert.equal(headers.get("Authorization"), null);
    assert.equal(headers.get("Cookie"), "session=fixture-cookie");
    return response({ key: "DEMO-1" });
  });
  assert.equal((await api.get_issue({ key: "DEMO-1" }))._testdocs.readTransport, "original_fallback");
});

test("wiki fallback uses its configured PAT but cannot bootstrap a missing password session", async (t) => {
  const config = { ...setup(t), fallback: "transient" };
  const calls = [];
  t.mock.method(global, "fetch", async (url, options) => {
    calls.push({ url: String(url), ...options });
    return String(url).startsWith(config.url) ? response({}, 503) : response({ id: "42", body: { storage: { value: "Full text" } } });
  });
  const pat = new ConfluenceClient("https://wiki.example.test", "", "fixture-wiki-pat", "bearer", undefined, "", false, config);
  assert.equal((await pat.getPage("42")).body, "Full text");
  assert.equal(calls[1].headers.Authorization, "Bearer fixture-wiki-pat");
  const password = new ConfluenceClient("https://wiki.example.test", "tester", "password", "basic", path.join(path.dirname(config.tokenFile), "missing-wiki-session.json"), "", true, config);
  calls.length = 0;
  await assert.rejects(password.getPage("42"), /READ_FALLBACK_UNAVAILABLE/);
  assert.equal(calls.length, 1);
});

test("parallel wiki reads keep each response's transport provenance separate", async (t) => {
  const config = { ...setup(t), fallback: "transient" };
  t.mock.method(global, "fetch", async (url) => {
    url = String(url);
    if (url.startsWith(config.url) && url.includes("/content/42?")) return response({}, 503);
    if (!url.startsWith(config.url)) await new Promise((resolve) => setTimeout(resolve, 10));
    return response({ id: url.includes("/42?") ? "42" : "43", body: { storage: { value: "Full text" } } });
  });
  const api = new ConfluenceClient("https://wiki.example.test", "", "fixture-wiki-pat", "bearer", undefined, "", false, config);
  const [reserve, primary] = await Promise.all([
    api.withReadRouting(() => api.getPage("42")), api.withReadRouting(() => api.getPage("43"))
  ]);
  assert.equal(reserve.transport, "original_fallback");
  assert.equal(primary.transport, "read_relay");
});
