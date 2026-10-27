const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { createConnectionDiagnostics } = require("./connection-diagnostics");

test("local connection diagnostics expose loaded code and configuration without secrets or HTTP requests", (t) => {
  const fetch = t.mock.method(global, "fetch", () => { throw new Error("Diagnostics must not make HTTP requests"); });
  const environment = {
    JIRA_URL: "https://url-user:dummy-url-password@jira.example.test/jira/?token=dummy-query-secret",
    JIRA_AUTH_MODE: "bearer", JIRA_CONNECTION_ID: "jira-selected", JIRA_SP_SECRET: "dummy-gateway-secret",
    JIRA_TOKEN: "dummy-api-token", JIRA_EMAIL: "private-user", JIRA_SESSION_FILE: "private-session-file"
  };
  const read = createConnectionDiagnostics(environment);
  environment.JIRA_SP_SECRET = "";
  environment.JIRA_AUTH_MODE = "basic";
  const result = read();
  assert.equal(result.runtime.sourceRoot, path.resolve(__dirname, "../.."));
  assert.equal(result.runtime.kitVersion, require("../../package.json").version);
  assert.match(result.runtime.codeHash, /^[0-9a-f]{64}$/);
  assert(!Number.isNaN(Date.parse(result.runtime.loadedAt)));
  assert.equal(result.runtime.httpDiagnosticsVersion, 1);
  assert.deepEqual(result.connection, {
    id: "jira-selected", baseUrl: "https://jira.example.test/jira", authMode: "bearer", sessionReuse: "none",
    issueReadTransport: "original", issueReadUrl: "https://jira.example.test/jira", writeAndTmsTransport: "original", readFallback: "none",
    gatewayHeader: { name: "X-Sp-Secret", configured: true, valid: true }
  });
  assert.equal(result.lastHttpError, null);
  assert.equal(result.networkRequestPerformed, false);
  assert.equal(result.serverPermissionsChecked, false);
  for (const secret of ["dummy-gateway-secret", "dummy-api-token", "private-user", "private-session-file", "url-user", "dummy-url-password", "dummy-query-secret"]) {
    assert(!JSON.stringify(result).includes(secret));
  }
  assert.equal(fetch.mock.callCount(), 0);
});

test("diagnostics distinguish password session reuse from Basic API-token authentication", () => {
  assert.equal(createConnectionDiagnostics({ JIRA_AUTH_MODE: "basic", JIRA_PASSWORD_SESSION: "1" })().connection.sessionReuse, "password");
  assert.equal(createConnectionDiagnostics({ JIRA_AUTH_MODE: "basic", JIRA_PASSWORD_SESSION: "0" })().connection.sessionReuse, "none");
  assert.equal(createConnectionDiagnostics({ JIRA_AUTH_MODE: "browser_session" })().connection.sessionReuse, "browser");
});

test("local diagnostics distinguish absent and invalid headers without disclosing their values", () => {
  const plain = createConnectionDiagnostics({})();
  assert.equal(plain.connection.baseUrl, null);
  assert.equal(plain.connection.authMode, "basic");
  assert.deepEqual(plain.connection.gatewayHeader, { name: "X-Sp-Secret", configured: false, valid: true });
  const invalid = createConnectionDiagnostics({ JIRA_SP_SECRET: "dummy-secret\r\nInjected: value", JIRA_AUTH_MODE: "unrecognized" })();
  assert.deepEqual(invalid.connection.gatewayHeader, { name: "X-Sp-Secret", configured: true, valid: false });
  assert.equal(invalid.connection.authMode, "unsupported");
  assert(!JSON.stringify(invalid).includes("dummy-secret"));
});
