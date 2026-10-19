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
    await assert.rejects(client(service, fixture.url, "bearer")(), /403/);
    assert.equal(fixture.requests.length, 1);
    assert.equal(fixture.requests[0].headers["x-sp-secret"], undefined);
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
        case "POST /rest/atm/1.0/testcase": return reply(201, { key: "DEMO-T2" });
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
      for (const [name, input] of [
        ["zephyr_get_projects", {}],
        ["zephyr_get_test_case", { testCaseKey: "DEMO-T1" }]
      ]) {
        const result = await unconfigured.callTool({ name, arguments: input });
        assert.equal(result.isError, true);
        assert.match(result.content[0].text, /403/);
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
    } finally { await mcp.close(); }
    assert.deepEqual(fixture.requests.map((req) => `${req.method} ${req.url.split("?")[0]}`), [
      "GET /rest/api/2/issue/DEMO-42", "GET /rest/tests/1.0/project",
      "GET /rest/atm/1.0/testcase/DEMO-T1", "GET /rest/tests/1.0/testcase/search",
      "GET /rest/tests/1.0/project/10000", "GET /rest/atm/1.0/testcase/search",
      "POST /rest/atm/1.0/testcase", "PUT /rest/atm/1.0/testcase/DEMO-T2"
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
