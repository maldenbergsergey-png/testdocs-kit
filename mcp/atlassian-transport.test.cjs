const test = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { createRequire } = require("node:module");
const { pathToFileURL } = require("node:url");
const { ConfluenceClient } = require("./confluence-mcp/dist/confluence.js");

async function serve(t, handler) {
  const requests = [];
  const server = http.createServer(async (req, res) => {
    let body = "";
    for await (const chunk of req) body += chunk;
    requests.push({ url: req.url, method: req.method, headers: req.headers, body });
    handler(req, res);
  });
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  t.after(() => new Promise((resolve) => {
    server.close(resolve);
    server.closeAllConnections();
  }));
  return { url: `http://127.0.0.1:${server.address().port}`, requests };
}

function success(res) {
  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ id: "42" }));
}

function client(service, url, mode, sessionFile, spSecret = "") {
  if (service === "confluence") {
    const api = new ConfluenceClient(url, "tester", "dummy-token", mode, sessionFile, spSecret);
    return () => api.getPage("42");
  }
  Object.assign(process.env, {
    JIRA_URL: url,
    JIRA_EMAIL: "tester",
    JIRA_TOKEN: "dummy-token",
    JIRA_SP_SECRET: spSecret,
    JIRA_AUTH_MODE: mode,
    JIRA_INSECURE_TLS: "0",
    JIRA_SESSION_FILE: sessionFile || ""
  });
  delete require.cache[require.resolve("./jira-mcp/jira-client.js")];
  const api = require("./jira-mcp/jira-client.js");
  return (method = "GET", body) => api[service === "jira" ? "jiraRequest" : "zephyrRequest"]("/probe", method, body);
}

async function launchMcp(service, connectionId, directory) {
  const requireSdk = createRequire(path.join(__dirname, "jira-mcp", "package.json"));
  const { Client } = await import(pathToFileURL(requireSdk.resolve("@modelcontextprotocol/sdk/client/index.js")).href);
  const { StdioClientTransport } = await import(pathToFileURL(requireSdk.resolve("@modelcontextprotocol/sdk/client/stdio.js")).href);
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [path.join(__dirname, "..", "scripts", "launch-mcp.mjs"), service, connectionId],
    env: {
      ...process.env, TESTDOCS_CONFIG_FILE: path.join(directory, "config.json"), TESTDOCS_CONFIG_DIR: directory,
      TESTDOCS_AUTO_UPDATE: "0",
      JIRA_SP_SECRET: "wrong-inherited-secret", CONFLUENCE_SP_SECRET: "wrong-inherited-secret"
    },
    stderr: "pipe"
  });
  const mcp = new Client({ name: "gateway-test", version: "1.0.0" });
  try {
    await mcp.connect(transport);
    return mcp;
  } catch (error) {
    await mcp.close();
    throw error;
  }
}

function diagnosticsFrom(text) {
  return JSON.parse(text.split("\nHTTP diagnostics: ")[1]);
}

test("Confluence MCP discovers later child pages and cursor search results without broadening scope", async (t) => {
  const query = 'type = "page" AND space = "DOCS" AND title ~ "Карточка проекта"';
  const cursor = "opaque+next/token=";
  const fixture = await serve(t, (req, res) => {
    const url = new URL(req.url, "http://fixture.test");
    let data;
    if (url.pathname === "/wiki/rest/api/content/100/child/page") {
      const start = Number(url.searchParams.get("start"));
      const children = Array.from({ length: start === 0 ? 50 : 1 }, (_, i) => ({
        id: String(start + i + 101), title: start ? "DEMO-42 - Site: Карточка проекта" : `Section ${i}`,
        status: "current", space: { key: "DOCS", name: "Product" }, _links: { webui: `/pages/${start + i + 101}` }
      }));
      data = { results: children, start, size: children.length, limit: 50,
        _links: start ? {} : { next: "/rest/api/content/100/child/page?start=50&limit=50" } };
    } else if (url.pathname === "/wiki/rest/api/content/search") {
      const last = url.searchParams.get("cursor") === cursor;
      data = { results: [{ id: last ? "202" : "201", title: last ? "DEMO-43 - Site: Карточка проекта" : "Site: Карточка проекта",
        type: "page", space: { key: "DOCS", name: "Product" }, _links: { webui: last ? "/pages/202" : "/pages/201" } }],
        size: 1, limit: 1, _links: last ? {} : { next: `/rest/api/content/search?cursor=${encodeURIComponent(cursor)}` } };
    } else return res.writeHead(500).end("Unexpected route");
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(data));
  });
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "testdocs-confluence-discovery-"));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  fs.writeFileSync(path.join(directory, "config.json"), JSON.stringify({
    version: 3, connections: { jira: [], eva: [], mcp: [], confluence: [
      { id: "wiki", enabled: true, baseUrl: `${fixture.url}/wiki`, authMode: "bearer", secret: "dummy-token" }
    ] }, tms: { category: "none", provider: "none" }
  }));
  const mcp = await launchMcp("confluence", "wiki", directory);
  t.after(() => mcp.close());
  const call = async (name, input) => {
    const result = await mcp.callTool({ name, arguments: input });
    assert.notEqual(result.isError, true, result.content[0]?.text);
    return JSON.parse(result.content[0].text);
  };
  const first = await call("get_page_children", { pageId: "100", limit: 50 });
  assert.equal(first.hasMore, true);
  assert.equal(first.nextStart, 50);
  assert.equal(first.total, null, "Batch size must not masquerade as total children");
  assert.equal(first.size, 50);
  const last = await call("get_page_children", { pageId: "100", limit: 50, start: first.nextStart });
  assert.equal(last.children[0].title, "DEMO-42 - Site: Карточка проекта");
  assert.equal(last.startIndex, 50);
  assert.equal(last.hasMore, false);
  const found = await call("search", { query, limit: 1 });
  assert.equal(found.nextCursor, cursor);
  assert.equal(found.totalSize, null);
  const more = await call("search", { query, limit: 1, cursor: found.nextCursor });
  assert.equal(more.results[0].id, "202");
  assert.equal(more.hasMore, false);
  assert.equal(more.results[0].url, `${fixture.url}/wiki/pages/202`);
  const searchRequests = fixture.requests.slice(2).map((r) => new URL(r.url, fixture.url));
  assert(searchRequests.every((url) => url.searchParams.get("cql") === query));
  assert.equal(searchRequests[1].searchParams.get("start"), null);
  assert.equal(searchRequests[1].searchParams.get("cursor"), cursor);
  for (const [name, input] of [
    ["search", { query, start: 1, cursor }],
    ["get_page_children", { pageId: "100", start: -1 }],
    ["get_page_children", { pageId: "100", start: 1.5 }],
    ["search", { query, limit: 0 }]
  ]) assert.equal((await mcp.callTool({ name, arguments: input })).isError, true);
  assert.equal(fixture.requests.length, 4, "Invalid continuation must fail before HTTP");
});

test("Confluence discovery preserves known totals, ancestry and unusable continuation gaps", async (t) => {
  const fixture = await serve(t, (req, res) => {
    const url = new URL(req.url, "http://fixture.test");
    const query = url.searchParams.get("cql");
    let data;
    if (url.pathname.endsWith("/content/202")) data = {
      id: "202", title: "DEMO-43 - Site: Карточка проекта", body: { storage: { value: "<p>Change details</p>" } },
      ancestors: [{ id: "100", title: "Site: Карточка проекта", _links: { webui: "/pages/100" } }]
    };
    else if (query === "offset") data = { results: [{ id: "202" }], start: 25, size: 1, totalSize: 27,
      _links: { next: "/rest/api/content/search?start=26&limit=1" } };
    else if (query === "known-total") data = { results: [{ id: "202" }], start: 0, totalSize: 2 };
    else if (query === "stalled") data = { results: [], start: 0, totalSize: 2 };
    else if (query === "bad-next") data = { results: [], _links: { next: "http://[invalid" } };
    else if (query === "repeated-next") data = { results: [{ id: "202" }], start: 25,
      _links: { next: "/rest/api/content/search?start=25" } };
    else if (query === "repeated-cursor") data = { results: [{ id: "202" }],
      _links: { next: "/rest/api/content/search?cursor=current" } };
    else if (query === "cursor-end") data = { results: [{ id: "202" }], totalSize: 2, _links: {} };
    else data = { results: [], size: 0, _links: {} };
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(data));
  });
  const api = new ConfluenceClient(fixture.url, "tester", "dummy-token", "bearer");
  const page = await api.getPage("202", true);
  assert.deepEqual(page.ancestors, [{ id: "100", title: "Site: Карточка проекта", url: `${fixture.url}/pages/100` }]);
  assert(new URL(fixture.requests[0].url, fixture.url).searchParams.get("expand").includes("ancestors"));
  const offset = await api.search("offset", 1, 25);
  assert.equal(offset.totalSize, 27);
  assert.equal(offset.nextStart, 26);
  assert.equal(offset.startIndex, 25);
  const known = await api.search("known-total");
  assert.equal(known.hasMore, true);
  assert.equal(known.nextStart, 1);
  for (const query of ["stalled", "bad-next", "repeated-next"]) {
    const partial = await api.search(query, 1, query === "repeated-next" ? 25 : 0);
    assert.equal(partial.hasMore, true, query);
    assert.equal(partial.nextStart, undefined, query);
    assert.equal(partial.nextCursor, undefined, query);
  }
  const empty = await api.search("empty");
  assert.equal(empty.hasMore, false);
  assert.equal(empty.size, 0);
  assert.equal(empty.totalSize, null);
  const cursorEnd = await api.search("cursor-end", 1, 0, "current");
  assert.equal(cursorEnd.hasMore, false, "A cursor batch without a next link is final even when a total is supplied");
  const repeated = await api.search("repeated-cursor", 1, 0, "current");
  assert.equal(repeated.hasMore, true);
  assert.equal(repeated.nextCursor, undefined, "Do not offer the same cursor again");
});

for (const service of ["jira", "zephyr", "confluence"]) {
  for (const mode of ["basic", "bearer"]) {
    test(`${service} ${mode}: canonical redirects reach JSON and keep same-origin authentication`, async (t) => {
      const fixture = await serve(t, (req, res) => {
        const status = req.url.match(/^\/hop-(\d+)/)?.[1];
        if (!status) return success(res);
        res.writeHead(Number(status), { Location: "/done" });
        res.end();
      });
      const authorization = mode === "bearer" ? "Bearer dummy-token" : `Basic ${Buffer.from("tester:dummy-token").toString("base64")}`;
      for (const status of [301, 302, 303, 307, 308]) {
        fixture.requests.length = 0;
        const result = await client(service, `${fixture.url}/hop-${status}`, mode)();
        assert.equal(result.id, "42");
        assert.equal(fixture.requests.length, 2);
        assert(fixture.requests.every((req) => req.headers.authorization === authorization));
      }
    });
  }

  test(`${service}: direct 403 is reported without a retry`, async (t) => {
    const fixture = await serve(t, (req, res) => {
      res.writeHead(403, { "Content-Type": "application/json" });
      res.end('{"message":"Forbidden"}');
    });
    await assert.rejects(client(service, fixture.url, "bearer")(), (error) => {
      assert.match(error.message, /403/);
      const diagnostics = diagnosticsFrom(error.message);
      assert.equal(diagnostics.request.headers["X-Sp-Secret"], false);
      assert.equal(diagnostics.request.headers.Authorization, true);
      assert.equal(diagnostics.request.authScheme, "bearer");
      assert.equal(diagnostics.response.status, 403);
      assert(!Number.isNaN(Date.parse(diagnostics.request.sentAt)));
      return true;
    });
    assert.equal(fixture.requests.length, 1);
    assert.equal(fixture.requests[0].headers["x-sp-secret"], undefined);
  });

  test(`${service}: forbidden errors expose safe request metadata and gateway correlation IDs`, async (t) => {
    const transactionId = "dd55cf41-1e9c-4f74-8d9e-9c307a5e0a63";
    const fixture = await serve(t, (req, res) => {
      res.writeHead(403, {
        "Content-Type": "text/plain", "X-Request-ID": "gateway-request-42",
        "Set-Cookie": "private=response-cookie", "X-Unlisted-Debug": "private-debug"
      });
      res.end("Forbidden " + "x".repeat(310) + `\nTransaction ID: ${transactionId}`);
    });
    await assert.rejects(client(service, fixture.url, "bearer", undefined, "dummy-gateway-secret")(), (error) => {
      const diagnostics = diagnosticsFrom(error.message);
      assert.equal(diagnostics.request.method, "GET");
      assert(diagnostics.request.url.startsWith(fixture.url));
      assert.equal(diagnostics.request.headers["X-Sp-Secret"], true);
      assert.equal(diagnostics.response.transactionId, transactionId);
      assert.equal(diagnostics.response.headers["x-request-id"], "gateway-request-42");
      assert.equal(diagnostics.response.headers["content-type"], "text/plain");
      for (const secret of ["dummy-gateway-secret", "dummy-token", "response-cookie", "private-debug"]) {
        assert(!error.message.includes(secret));
      }
      assert.deepEqual(diagnostics, error.httpDiagnostics);
      return true;
    });
    assert.equal(fixture.requests.length, 1);
  });

  test(`${service}: optional X-Sp-Secret satisfies the gateway and survives same-origin redirects`, async (t) => {
    const fixture = await serve(t, (req, res) => {
      if (req.headers["x-sp-secret"] !== "dummy-gateway-secret") {
        res.writeHead(403, { "Content-Type": "application/json" });
        res.end('{"message":"gateway denied"}');
      } else if (req.url !== "/done") {
        res.writeHead(302, { Location: "/done" });
        res.end();
      } else success(res);
    });
    await assert.rejects(client(service, fixture.url, "bearer")(), /403/);
    fixture.requests.length = 0;
    const result = await client(service, fixture.url, "bearer", undefined, "dummy-gateway-secret")();
    assert.equal(result.id, "42");
    assert.equal(fixture.requests.length, 2);
    assert(fixture.requests.every((req) => req.headers["x-sp-secret"] === "dummy-gateway-secret" && req.headers.authorization === "Bearer dummy-token"));
  });

  test(`${service}: a gateway secret stops redirects to another origin`, async (t) => {
    const destination = await serve(t, (req, res) => success(res));
    const source = await serve(t, (req, res) => {
      res.writeHead(307, { Location: `${destination.url}/done` });
      res.end();
    });
    await assert.rejects(client(service, source.url, "bearer", undefined, "dummy-gateway-secret")(), /X-Sp-Secret.*origin/);
    assert.equal(source.requests[0].headers["x-sp-secret"], "dummy-gateway-secret");
    assert.equal(destination.requests.length, 0);
  });

  test(`${service}: reflected secrets are redacted from HTTP and JSON errors`, async (t) => {
    for (const status of [200, 403]) {
      const fixture = await serve(t, (req, res) => {
        res.writeHead(status, { "Content-Type": status === 403 ? "text/html" : "application/json" });
        res.end('x'.repeat(290) + req.headers["x-sp-secret"]);
      });
      await assert.rejects(client(service, fixture.url, "bearer", undefined, "  dummy-gateway-secret  ")(), (error) => {
        assert(!error.message.includes("dummy-gate"));
        return true;
      });
    }
  });

  test(`${service}: Authorization is not forwarded to another origin`, async (t) => {
    const destination = await serve(t, (req, res) => success(res));
    const source = await serve(t, (req, res) => {
      res.writeHead(302, { Location: `${destination.url}/done` });
      res.end();
    });
    await client(service, source.url, "bearer")();
    assert.equal(source.requests[0].headers.authorization, "Bearer dummy-token");
    assert.equal(destination.requests.length, 1);
    assert.equal(destination.requests[0].headers.authorization, undefined);
  });

  test(`${service}: browser session does not follow a redirect with cookies`, async (t) => {
    const fixture = await serve(t, (req, res) => {
      res.writeHead(302, { Location: "/done" });
      res.end();
    });
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "testdocs-redirect-session-"));
    t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
    const sessionFile = path.join(directory, "session.json");
    fs.writeFileSync(sessionFile, JSON.stringify({
      service: service === "zephyr" ? "jira" : service,
      baseUrl: fixture.url,
      cookies: [{ name: "session", value: "dummy-cookie", domain: "127.0.0.1", path: "/", secure: false }]
    }));
    await assert.rejects(client(service, fixture.url, "browser_session", sessionFile, "dummy-gateway-secret")(), /AUTH_REQUIRED/);
    assert.equal(fixture.requests.length, 1);
    assert.equal(fixture.requests[0].headers.cookie, "session=dummy-cookie");
    assert.equal(fixture.requests[0].headers["x-sp-secret"], "dummy-gateway-secret");
  });
}

test("gateway redirects preserve fetch POST-to-GET behavior for 301/302/303", async (t) => {
  const { fetchWithSpSecret } = require("./atlassian-http.cjs");
  for (const status of [301, 302, 303]) {
    const fixture = await serve(t, (req, res) => {
      if (req.url === "/done") return success(res);
      res.writeHead(status, { Location: "/done" });
      res.end();
    });
    const response = await fetchWithSpSecret(fixture.url, {
      method: "POST", redirect: "follow", headers: { "Content-Type": "application/json" }, body: '{"query":"fixture"}'
    }, "dummy-gateway-secret");
    await response.text();
    assert.equal(fixture.requests[1].method, "GET");
    assert.equal(fixture.requests[1].body, "");
    assert.equal(fixture.requests[1].headers["content-type"], undefined);
  }
});

test("gateway redirect loops are bounded and invalid header values never reach the network", async (t) => {
  const { fetchWithSpSecret } = require("./atlassian-http.cjs");
  const fixture = await serve(t, (req, res) => {
    res.writeHead(302, { Location: "/loop" });
    res.end();
  });
  for (const value of [42, "dummy-secret\r\nInjected: header"]) {
    await assert.rejects(fetchWithSpSecret(fixture.url, { redirect: "follow" }, value), (error) => {
      assert(!error.message.includes("dummy-secret"));
      return true;
    });
  }
  assert.equal(fixture.requests.length, 0);
  await assert.rejects(fetchWithSpSecret(fixture.url, { redirect: "follow" }, "dummy-gateway-secret"), /20/);
  assert.equal(fixture.requests.length, 21);
});

test("MCP launcher uses each connection's own optional gateway secret", async (t) => {
  const fixture = await serve(t, (req, res) => success(res));
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "testdocs-gateway-launcher-"));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const config = { version: 3, connections: { jira: [], confluence: [], eva: [], mcp: [] }, tms: { category: "none", provider: "none" } };
  for (const service of ["jira", "confluence"]) {
    config.connections[service] = ["protected", "plain"].map((id) => ({
      id, enabled: true, authMode: "bearer", secret: "dummy-token", apiVersion: "2",
      url: fixture.url, baseUrl: fixture.url,
      ...(id === "protected" ? { spSecret: `dummy-${service}-gateway` } : {})
    }));
  }
  const configFile = path.join(directory, "config.json");
  fs.writeFileSync(configFile, JSON.stringify(config));
  for (const service of ["jira", "confluence"]) {
    for (const entry of config.connections[service]) {
      const mcp = await launchMcp(service, entry.id, directory);
      try {
        const result = await mcp.callTool({ name: service === "jira" ? "get_issue" : "get_page", arguments: service === "jira" ? { key: "DEMO-42" } : { pageId: "42" } });
        assert.notEqual(result.isError, true);
        assert.equal(fixture.requests.at(-1).headers["x-sp-secret"], entry.spSecret);
      } finally { await mcp.close(); }
    }
  }
  assert.equal(fixture.requests.length, 4);
});

for (const mode of ["basic", "bearer", "browser_session"]) {
  test(`Zephyr MCP ${mode}: saved Jira gateway header reaches reads, fallback, creation and correction`, async (t) => {
    let denyCreation = false;
    const fixture = await serve(t, (req, res) => {
      const reply = (status, data) => {
        res.writeHead(status, { "Content-Type": "application/json" });
        res.end(data === undefined ? undefined : JSON.stringify(data));
      };
      if (req.headers["x-sp-secret"] !== "dummy-selected-jira-gateway") {
        return reply(403, { message: "gateway denied" });
      }
      const route = `${req.method} ${req.url.split("?")[0]}`;
      switch (route) {
        case "GET /rest/api/2/issue/DEMO-42": return reply(200, { key: "DEMO-42" });
        case "GET /rest/tests/1.0/project": return reply(200, [{ key: "DEMO" }]);
        case "GET /rest/tests/1.0/testcase/search": return reply(404, { message: "use ATM API" });
        case "GET /rest/tests/1.0/project/10000": return reply(200, { key: "DEMO" });
        case "GET /rest/atm/1.0/testcase/search": return reply(200, [{ key: "DEMO-T1" }]);
        case "GET /rest/atm/1.0/testcase/DEMO-T1": return reply(200, {
          key: "DEMO-T1", testScript: { steps: [{ description: "Open page", expectedResult: "Page opens" }] }
        });
        case "POST /rest/atm/1.0/testcase":
          if (denyCreation) {
            res.writeHead(403, { "Content-Type": "text/plain", "X-Request-ID": "gateway-post-42" });
            return res.end("Forbidden\nTransaction ID: dd55cf41-1e9c-4f74-8d9e-9c307a5e0a63");
          }
          return reply(201, { key: "DEMO-T2" });
        case "PUT /rest/atm/1.0/testcase/DEMO-T2": return reply(204);
        default: return reply(500, { message: "unexpected fixture route" });
      }
    });
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "testdocs-zephyr-gateway-"));
    t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
    const selected = {
      id: "target", enabled: true, url: fixture.url, authMode: mode,
      username: "tester", secret: "dummy-token", apiVersion: "2"
    };
    const config = {
      version: 3,
      connections: {
        jira: [{ ...selected, id: "other", spSecret: "dummy-other-jira-gateway" }, selected],
        confluence: [{ id: "wiki", enabled: true, baseUrl: fixture.url, authMode: "bearer", secret: "dummy-token", spSecret: "dummy-confluence-gateway" }],
        eva: [], mcp: []
      },
      tms: { category: "zephyr", provider: "zephyr_scale", jiraConnectionId: selected.id }
    };
    const configFile = path.join(directory, "config.json");
    fs.writeFileSync(configFile, JSON.stringify(config));
    if (mode === "browser_session") {
      fs.mkdirSync(path.join(directory, "sessions"));
      fs.writeFileSync(path.join(directory, "sessions", "jira-target.json"), JSON.stringify({
        service: "jira", baseUrl: fixture.url,
        cookies: [{ name: "session", value: "dummy-cookie", domain: "127.0.0.1", path: "/", secure: false }]
      }));
    }

    const unconfigured = await launchMcp("jira", selected.id, directory);
    try {
      const local = JSON.parse((await unconfigured.callTool({ name: "jira_get_connection_diagnostics", arguments: {} })).content[0].text);
      assert.equal(local.connection.id, "target");
      assert.equal(local.connection.gatewayHeader.configured, false);
      assert.equal(local.lastHttpError, null);
      assert.equal(local.runtime.sourceRoot, path.resolve(__dirname, ".."));
      assert.equal(fixture.requests.length, 0, "Local diagnostics made an HTTP request");
      for (const [name, input] of [
        ["zephyr_get_projects", {}],
        ["zephyr_get_test_case", { testCaseKey: "DEMO-T1" }]
      ]) {
        const result = await unconfigured.callTool({ name, arguments: input });
        assert.equal(result.isError, true);
        assert.match(result.content[0].text, /403/);
        assert.equal(diagnosticsFrom(result.content[0].text).request.headers["X-Sp-Secret"], false);
      }
    } finally { await unconfigured.close(); }
    assert.equal(fixture.requests.length, 2, "A gateway 403 must not trigger retries or fallback");
    assert(fixture.requests.every((req) => req.headers["x-sp-secret"] === undefined));
    fixture.requests.length = 0;

    selected.spSecret = "dummy-selected-jira-gateway";
    fs.writeFileSync(configFile, JSON.stringify(config));
    const mcp = await launchMcp("jira", selected.id, directory);
    const call = async (name, input = {}) => {
      const result = await mcp.callTool({ name, arguments: input });
      assert.notEqual(result.isError, true, JSON.stringify(result));
      return JSON.parse(result.content[0].text);
    };
    try {
      const configured = await call("jira_get_connection_diagnostics");
      assert.equal(configured.connection.gatewayHeader.configured, true);
      assert.equal(configured.connection.gatewayHeader.valid, true);
      assert.equal(configured.lastHttpError, null, "HTTP error history survived a process restart");
      assert.equal(fixture.requests.length, 0);
      assert.equal((await call("get_issue", { key: "DEMO-42" })).key, "DEMO-42");
      assert.equal((await call("zephyr_get_projects"))[0].key, "DEMO");
      assert.equal((await call("zephyr_get_test_case", { testCaseKey: "DEMO-T1" })).testScript.steps.length, 1);
      assert.equal((await call("zephyr_search_test_cases", { projectId: "10000" })).results[0].key, "DEMO-T1");
      const created = await call("zephyr_create_test_case", {
        confirmed: true, projectKey: "DEMO", folder: "/", name: "Gateway fixture",
        steps: [{ description: "Open page", expectedResult: "Page opens" }]
      });
      assert.equal(created.key, "DEMO-T2");
      assert.equal((await call("zephyr_update_session_test_case", {
        confirmed: true, testCaseKey: created.key, name: "Corrected gateway fixture"
      })).key, created.key);
      denyCreation = true;
      const denied = await mcp.callTool({ name: "zephyr_create_test_case", arguments: {
        confirmed: true, projectKey: "DEMO", folder: "/", name: "Private case content",
        steps: [{ description: "Private step content", expectedResult: "Private result content" }]
      } });
      assert.equal(denied.isError, true);
      const text = denied.content[0].text;
      const diagnostics = diagnosticsFrom(text);
      assert.equal(diagnostics.request.method, "POST");
      assert.equal(diagnostics.request.url, `${fixture.url}/rest/atm/1.0/testcase`);
      assert.equal(diagnostics.request.headers["X-Sp-Secret"], true);
      assert.equal(diagnostics.request.authScheme, mode === "browser_session" ? "cookie" : mode);
      assert.equal(diagnostics.request.bodyBytes, Buffer.byteLength(fixture.requests.at(-1).body));
      assert.equal(diagnostics.response.status, 403);
      assert.equal(diagnostics.response.transactionId, "dd55cf41-1e9c-4f74-8d9e-9c307a5e0a63");
      assert.equal(diagnostics.response.headers["x-request-id"], "gateway-post-42");
      const requestCount = fixture.requests.length;
      const recovered = await call("jira_get_connection_diagnostics");
      assert.deepEqual(recovered.lastHttpError, diagnostics);
      assert.equal(recovered.serverPermissionsChecked, false);
      assert.equal(fixture.requests.length, requestCount, "Reading the error history retried a write");
      for (const secret of [selected.spSecret, "dummy-token", "dummy-cookie", "Private case content", "Private step content", "Private result content"]) {
        assert(!text.includes(secret));
        assert(!JSON.stringify(recovered).includes(secret));
      }
    } finally { await mcp.close(); }
    assert.deepEqual(fixture.requests.map((req) => `${req.method} ${req.url.split("?")[0]}`), [
      "GET /rest/api/2/issue/DEMO-42", "GET /rest/tests/1.0/project",
      "GET /rest/atm/1.0/testcase/DEMO-T1", "GET /rest/tests/1.0/testcase/search",
      "GET /rest/tests/1.0/project/10000", "GET /rest/atm/1.0/testcase/search",
      "POST /rest/atm/1.0/testcase", "PUT /rest/atm/1.0/testcase/DEMO-T2",
      "POST /rest/atm/1.0/testcase"
    ]);
    for (const req of fixture.requests) {
      assert.equal(req.headers["x-sp-secret"], selected.spSecret);
      if (mode === "browser_session") {
        assert.equal(req.headers.cookie, "session=dummy-cookie");
        assert.equal(req.headers.authorization, undefined);
      } else {
        assert.equal(req.headers.authorization, mode === "bearer"
          ? "Bearer dummy-token" : `Basic ${Buffer.from("tester:dummy-token").toString("base64")}`);
      }
    }
  });
}

test("HTTP diagnostics omit query values and redact reflected Basic, Bearer and cookie credentials before truncation", async (t) => {
  const { fetchWithSpSecret, withHttpDiagnostics } = require("./atlassian-http.cjs");
  for (const authentication of [
    { Authorization: "Bearer dummy-bearer-credential" },
    { Authorization: `Basic ${Buffer.from("tester:dummy-basic-password").toString("base64")}` },
    { Cookie: "session=dummy-session-cookie; other=dummy-other-cookie" }
  ]) {
    const fixture = await serve(t, (req, res) => {
      res.writeHead(403, { "Content-Type": "text/plain", "X-Request-ID": "dummy-gateway-secret" });
      res.end(JSON.stringify({ authorization: req.headers.authorization, cookie: req.headers.cookie,
        token: "dummy-bearer-credential", password: "dummy-basic-password", gateway: req.headers["x-sp-secret"] }));
    });
    const response = await fetchWithSpSecret(`${fixture.url}/probe?token=private-query-value`, {
      method: "POST", headers: { ...authentication, "Content-Type": "application/json" },
      body: '{"private":"private-body-value"}'
    }, "dummy-gateway-secret");
    const body = await response.text();
    const error = withHttpDiagnostics(new Error(body), response, body);
    assert.equal(error.httpDiagnostics.request.url, `${fixture.url}/probe?[omitted]`);
    assert.equal(error.httpDiagnostics.response.url, `${fixture.url}/probe?[omitted]`);
    assert.equal(error.httpDiagnostics.response.headers["x-request-id"], "[REDACTED]");
    for (const value of [...Object.values(authentication), "dummy-gateway-secret", "dummy-session-cookie", "dummy-other-cookie", "private-query-value", "private-body-value"]) {
      assert(!error.message.includes(value));
    }
    if (authentication.Authorization?.startsWith("Basic")) assert(!error.message.includes("dummy-basic-password"));
    if (authentication.Authorization?.startsWith("Bearer")) assert(!error.message.includes("dummy-bearer-credential"));
  }
  for (const service of ["jira", "zephyr", "confluence"]) {
    const fixture = await serve(t, (req, res) => {
      res.writeHead(403, { "Content-Type": "text/plain" });
      res.end("x".repeat(295) + "dummy-token");
    });
    await assert.rejects(client(service, fixture.url, "bearer")(), (error) => {
      assert(!error.message.includes("dummy"), "A truncated credential prefix leaked");
      return true;
    });
  }
});

test("HTTP diagnostics describe the final request after a gateway POST-to-GET redirect", async (t) => {
  const fixture = await serve(t, (req, res) => {
    if (req.url !== "/done") {
      res.writeHead(302, { Location: "/done" });
      return res.end();
    }
    res.writeHead(403, { "Content-Type": "text/plain" });
    res.end("Forbidden");
  });
  await assert.rejects(client("zephyr", fixture.url, "bearer", undefined, "dummy-gateway-secret")("POST", { name: "private" }), (error) => {
    assert.equal(error.httpDiagnostics.request.method, "GET");
    assert.equal(error.httpDiagnostics.request.url, `${fixture.url}/done`);
    assert.equal(error.httpDiagnostics.request.redirectsFollowed, 1);
    assert.equal(error.httpDiagnostics.request.bodyBytes, undefined);
    assert.equal(error.httpDiagnostics.request.headers["Content-Type"], "");
    return true;
  });
  assert.equal(fixture.requests.length, 2);
});

for (const service of ["jira", "zephyr"]) {
  test(`${service}: 307/308 preserve a POST request and its JSON body`, async (t) => {
    const fixture = await serve(t, (req, res) => {
      const status = req.url.match(/^\/hop-(\d+)/)?.[1];
      if (!status) return success(res);
      res.writeHead(Number(status), { Location: "/done" });
      res.end();
    });
    const body = { jql: "project = DEMO" };
    for (const status of [307, 308]) {
      fixture.requests.length = 0;
      await client(service, `${fixture.url}/hop-${status}`, "bearer", undefined, "dummy-gateway-secret")("POST", body);
      assert.equal(fixture.requests.length, 2);
      assert(fixture.requests.every((req) => req.method === "POST" && req.body === JSON.stringify(body)));
      assert(fixture.requests.every((req) => req.headers["x-sp-secret"] === "dummy-gateway-secret"));
    }
  });
}
