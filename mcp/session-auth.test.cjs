const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { getCookieHeader, isAuthenticationFailure } = require("./session-auth.cjs");

function sessionFile(contents) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "testdocs-session-"));
  const file = path.join(directory, "jira.json");
  fs.writeFileSync(file, JSON.stringify(contents), { mode: 0o600 });
  return { directory, file };
}

test("browser session sends only matching and non-expired cookies", (t) => {
  const { directory, file } = sessionFile({
    version: 1,
    service: "jira",
    baseUrl: "https://jira.example.test",
    cookies: [
      { name: "JSESSIONID", value: "session-value", domain: ".example.test", path: "/", secure: true, expires: -1 },
      { name: "expired", value: "old", domain: "jira.example.test", path: "/", secure: true, expires: 1 },
      { name: "foreign", value: "no", domain: "other.example.test", path: "/", secure: true, expires: -1 }
    ]
  });
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));

  assert.equal(
    getCookieHeader(file, "https://jira.example.test/rest/api/2/myself", "jira"),
    "JSESSIONID=session-value"
  );
});

test("browser session is never reused for another origin", (t) => {
  const { directory, file } = sessionFile({
    version: 1,
    service: "jira",
    baseUrl: "https://jira.example.test",
    cookies: [{ name: "JSESSIONID", value: "secret", domain: "jira.example.test", path: "/" }]
  });
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));

  assert.throws(
    () => getCookieHeader(file, "https://attacker.example.test/rest/api/2/issue/DEMO-1", "jira"),
    /AUTH_REQUIRED/
  );
});

test("browser session is never reused for another service path on the same host", (t) => {
  const { directory, file } = sessionFile({
    version: 1,
    service: "jira",
    baseUrl: "https://tools.example.test/jira",
    cookies: [{ name: "JSESSIONID", value: "secret", domain: "tools.example.test", path: "/" }]
  });
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));

  assert.throws(
    () => getCookieHeader(file, "https://tools.example.test/confluence/rest/api/content", "jira"),
    /AUTH_REQUIRED/
  );
  assert.throws(
    () => getCookieHeader(file, "https://tools.example.test/jira-malicious/rest/api/content", "jira"),
    /AUTH_REQUIRED/
  );
});

test("authentication failures are distinguished from ordinary forbidden responses", () => {
  const headers = (values = {}) => ({ get: (name) => values[name.toLowerCase()] || null });
  assert.equal(isAuthenticationFailure({ status: 401, headers: headers() }), true);
  assert.equal(isAuthenticationFailure({ status: 302, headers: headers() }), true);
  assert.equal(
    isAuthenticationFailure({ status: 403, headers: headers({ "content-type": "application/json" }) }, '{"error":"forbidden"}'),
    false
  );
  assert.equal(
    isAuthenticationFailure({ status: 403, headers: headers({ "x-seraph-loginreason": "AUTHENTICATION_DENIED" }) }),
    true
  );
});

test("HTML login page with status 200 is treated as an expired session", () => {
  const body = "<html><form>Sign in with SAML</form></html>";
  const headers = { get: (name) => name.toLowerCase() === "content-type" ? "text/html; charset=utf-8" : null };
  assert.equal(isAuthenticationFailure({ status: 200, headers }, body), true);
});
