const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { getCookieHeader, isAuthenticationFailure, cookiesFromResponse } = require("./session-auth.cjs");

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

test("Set-Cookie replaces cookies by name/domain/path and respects deletion, expiry and origin", (t) => {
  const session = { service: "jira", baseUrl: "https://jira.example.test/jira", cookies: [
    { name: "session", value: "old", domain: ".jira.example.test", path: "/jira" },
    { name: "retired", value: "old", domain: "jira.example.test", path: "/" },
    { name: "same", value: "root", domain: "jira.example.test", path: "/" }
  ] };
  const headers = new Headers();
  for (const value of [
    "session=rotated; Domain=jira.example.test; Path=/jira; HttpOnly; Secure",
    "retired=; Path=/; Max-Age=0; Expires=Thu, 01 Jan 2099 00:00:00 GMT",
    "expired=old; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT",
    "fresh=valid; Max-Age=60; Expires=Thu, 01 Jan 1970 00:00:00 GMT",
    "same=specific; Path=/jira/rest/api",
    "foreign=no; Domain=other.example.test; Path=/"
  ]) headers.append("Set-Cookie", value);
  const cookies = cookiesFromResponse(session, "https://jira.example.test/jira/rest/api/2/myself", { headers });
  assert.equal(cookies.filter((c) => c.name === "session").length, 1);
  assert.equal(cookies.find((c) => c.name === "session").value, "rotated");
  assert(!cookies.some((c) => ["retired", "expired", "foreign"].includes(c.name)));
  assert(cookies.find((c) => c.name === "fresh").expires > Date.now() / 1000);
  const { directory, file } = sessionFile({ ...session, cookies });
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const header = getCookieHeader(file, "https://jira.example.test/jira/rest/api/2/myself", "jira");
  assert(header.indexOf("same=specific") < header.indexOf("same=root"));
  assert(header.includes("fresh=valid"));
});

test("malformed session JSON never echoes cookie values in an authentication error", (t) => {
  const { directory, file } = sessionFile({});
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  fs.writeFileSync(file, '{"cookies":"private-cookie-value');
  assert.throws(() => getCookieHeader(file, "https://jira.example.test", "jira"), (error) => {
    assert.equal(error.code, "AUTH_REQUIRED");
    assert(!error.message.includes("private-cookie-value"));
    return true;
  });
});
