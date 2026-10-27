import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { collectReadRelays } from "./configure-read-relay.mjs";
import { boundReadRelay, issueRouting, writePrivate } from "./read-relay-config.mjs";

const config = { version: 3, clients: ["generic"], connections: {
  jira: [
    { id: "first", enabled: true, url: "https://jira.first.example.test", authMode: "basic", username: "tester", secret: "existing-password", enableBugCreation: true },
    { id: "second", enabled: true, url: "https://jira.second.example.test", authMode: "bearer", secret: "existing-pat" }
  ],
  confluence: [{ id: "wiki", enabled: true, baseUrl: "https://wiki.first.example.test", authMode: "bearer", secret: "existing-wiki-token" }]
}, tms: { category: "zephyr", jiraConnectionId: "first" } };

test("explicit setup keeps original connections, writes, TMS and other companies intact", async () => {
  const before = structuredClone(config);
  const old = { version: 1, jira: { second: { sourceUrl: config.connections.jira[1].url, url: "https://gateway.second.example.test/jira", tokenFile: "/private/tmp/old-credential" } }, confluence: {} };
  const answers = ["1,3", "https://gateway.first.example.test/relay/support", "DEMO", "https://gateway.first.example.test/relay/wiki", "https://gateway.first.example.test/kb/search", "1"];
  let tokenWrites = 0;
  const next = await collectReadRelays(config, old, {
    ask: async () => answers.shift(), askToken: async () => "fixture-private-token",
    saveToken: async (token) => { assert.equal(token, "fixture-private-token"); tokenWrites++; return "/private/tmp/new-credential"; }
  });
  assert.deepEqual(config, before);
  assert.deepEqual(next.jira.second, old.jira.second);
  assert.equal(next.jira.first.tokenFile, next.confluence.wiki.tokenFile);
  assert.equal(next.jira.first.fallback, "transient");
  assert.equal(tokenWrites, 1);
  assert(!JSON.stringify(next).includes("fixture-private-token"));
  assert.equal(boundReadRelay(next, "jira", config.connections.jira[0]).url, "https://gateway.first.example.test/relay/support");
  assert.deepEqual(issueRouting(config, next).map((item) => item.projectKeys), [["DEMO"], []]);
  assert.throws(() => boundReadRelay(next, "jira", { ...config.connections.jira[0], url: "https://changed.example.test" }), /изменился/);
});

test("invalid selections and cross-origin knowledge endpoints never save a key", async () => {
  const neverSave = async () => assert.fail("Credential must not be saved");
  await assert.rejects(collectReadRelays(config, { version: 1, jira: {}, confluence: {} }, {
    ask: async () => "1,1", askToken: neverSave, saveToken: neverSave
  }), /без повторов/);
  const answers = ["3", "https://gateway.first.example.test/wiki", "https://unrelated.example.test/search"];
  await assert.rejects(collectReadRelays(config, { version: 1, jira: {}, confluence: {} }, {
    ask: async () => answers.shift(), askToken: neverSave, saveToken: neverSave
  }), /origin/);
  const mixedOrigins = ["1,2", "https://gateway.first.example.test/jira", "DEMO", "https://gateway.second.example.test/jira", "OTHER"];
  await assert.rejects(collectReadRelays(config, { version: 1, jira: {}, confluence: {} }, {
    ask: async () => mixedOrigins.shift(), askToken: neverSave, saveToken: neverSave
  }), /одному origin/);
});

test("credential files and sidecar settings are private and atomic", (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "testdocs-relay-config-"));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const file = path.join(directory, "credentials", "relay.key");
  writePrivate(file, "fixture-secret");
  writePrivate(file, "rotated-secret");
  assert.equal(fs.readFileSync(file, "utf8"), "rotated-secret");
  if (process.platform !== "win32") assert.equal(fs.statSync(file).mode & 0o777, 0o600);
  assert.deepEqual(fs.readdirSync(path.dirname(file)), ["relay.key"]);
});

test("standard setup and its public scripts do not enable or advertise optional relay setup", () => {
  const install = fs.readFileSync(new URL("./install.mjs", import.meta.url), "utf8");
  const scripts = JSON.parse(fs.readFileSync(new URL("../package.json", import.meta.url), "utf8")).scripts;
  assert(!install.includes("configure-read-relay"));
  assert(!Object.values(scripts).some((value) => value.includes("configure-read-relay")));
});

test("real MCP launchers load private routes without replacing write auth or choosing another company", { timeout: 20000 }, async (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "testdocs-relay-launcher-"));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  writePrivate(path.join(directory, "config.json"), JSON.stringify(config));
  const tokenFile = path.join(directory, "credential");
  writePrivate(tokenFile, "fixture-relay-key");
  writePrivate(path.join(directory, "read-relays.json"), JSON.stringify({ version: 1, jira: {
    first: { sourceUrl: config.connections.jira[0].url, url: "https://gateway.example.test/relay/jira", tokenFile, projectKeys: ["DEMO"] }
  }, confluence: {
    wiki: { sourceUrl: config.connections.confluence[0].baseUrl, url: "https://gateway.example.test/relay/wiki", tokenFile, knowledgeSearchUrl: "https://gateway.example.test/kb/search" }
  } }));
  const callsFile = path.join(directory, "calls.jsonl");
  const preload = path.join(directory, "fetch.cjs");
  fs.writeFileSync(preload, `
const fs = require("node:fs");
global.fetch = async (url, options = {}) => {
  url = String(url);
  const headers = new Headers(options.headers);
  fs.appendFileSync(${JSON.stringify(callsFile)}, JSON.stringify({url,method:options.method || "GET",scheme:headers.get("authorization")?.split(" ")[0]}) + "\\n");
  if (!/^https:\\/\\/(gateway|jira.first|wiki.first)\\.example\\.test\\//.test(url)) throw new Error("Unexpected fixture URL");
  let value = { key: "DEMO-2" };
  if (url.includes("/myself")) value = {name:"tester"};
  else if (url.includes("/createmeta")) value = {projects:[{key:"DEMO",issuetypes:[]}]};
  else if (url.includes("/kb/search")) value = {hits:[{title:"Requirements",text:"Discovery snippet"}]};
  else if (url.includes("/content/42")) value = {id:"42",body:{storage:{value:"Full requirements"}},_links:{webui:"/pages/42"}};
  return new Response(JSON.stringify(value), {headers:{"content-type":"application/json"}});
};
`);
  const require = createRequire(new URL("../mcp/jira-mcp/package.json", import.meta.url));
  const { Client } = require("@modelcontextprotocol/sdk/client/index.js");
  const { StdioClientTransport } = require("@modelcontextprotocol/sdk/client/stdio.js");
  const env = { ...process.env, TESTDOCS_CONFIG_DIR: directory, TESTDOCS_INSTALL_ROOT: directory, TESTDOCS_DATA_DIR: path.join(directory, "data"), TESTDOCS_AUTO_UPDATE_INTERNAL: "1", NODE_OPTIONS: `--require=${preload}` };
  const connect = async (service, id) => {
    const client = new Client({ name: "relay-launcher-fixture", version: "1" });
    await client.connect(new StdioClientTransport({ command: process.execPath, args: [new URL("./launch-mcp.mjs", import.meta.url).pathname, service, id], env, stderr: "pipe" }));
    t.after(() => client.close());
    return (name, args) => client.callTool({ name, arguments: args });
  };
  const jira = await connect("jira", "first");
  assert((await jira("get_issue", { key: "https://jira.second.example.test/browse/OTHER-1" })).isError);
  assert(!fs.existsSync(callsFile));
  assert(!(await jira("get_issue", { key: "DEMO-1" })).isError);
  assert(!(await jira("jira_get_bug_create_metadata", { projectKey: "DEMO" })).isError);
  assert(!(await jira("jira_create_bug", { confirmed: true, projectKey: "DEMO", issueTypeId: "1", summary: "FE. Save fails" })).isError);
  assert(!(await jira("get_issue", { key: "DEMO-2" })).isError);
  const wiki = await connect("confluence", "wiki");
  assert(!(await wiki("get_page", { pageId: "42" })).isError);
  assert(!(await wiki("search", { query: "Where are requirements?", mode: "semantic" })).isError);
  const calls = fs.readFileSync(callsFile, "utf8").trim().split("\n").map((line) => JSON.parse(line));
  assert(calls.filter((call) => call.url.startsWith("https://gateway.example.test/")).every((call) => call.scheme === "Bearer"));
  assert(calls.filter((call) => call.url.startsWith("https://jira.first.example.test/")).every((call) => call.scheme === "Basic"));
  assert(calls.some((call) => call.url === "https://jira.first.example.test/rest/api/2/issue/DEMO-2" && call.method === "GET"));
  assert(calls.some((call) => call.url === "https://gateway.example.test/kb/search" && call.method === "POST"));
  assert(!calls.some((call) => call.url.startsWith("https://wiki.first.example.test/")));
  assert.equal(JSON.parse(fs.readFileSync(path.join(directory, "config.json"))).connections.jira[0].secret, "existing-password");
});
