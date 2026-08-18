const test = require("node:test");
const assert = require("node:assert/strict");
const { getAuthorizationHeader } = require("./auth");

test("uses the vendor Api-Token header without exposing a token elsewhere", async () => {
  assert.equal(await getAuthorizationHeader({
    baseUrl: "https://qa-tools.company.example",
    authMode: "api_token",
    secret: "personal-token"
  }), "Api-Token personal-token");
});

test("exchanges a login and password for a bearer token", async () => {
  let request;
  const header = await getAuthorizationHeader({
    baseUrl: "https://qa-tools.company.example/",
    authMode: "password",
    username: "tester",
    secret: "password",
    fetchImpl: async (url, options) => {
      assert.doesNotThrow(() => new Request(url, options));
      request = { url, options };
      return {
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ access_token: "short-lived-jwt" })
      };
    }
  });
  assert.equal(request.url, "https://qa-tools.company.example/api/uaa/oauth/token");
  assert.equal(request.options.body.get("grant_type"), "password");
  assert.equal(request.options.body.get("username"), "tester");
  assert.equal(request.options.body.get("password"), "password");
  assert.equal(new Headers(request.options.headers).has("expect"), false);
  assert.equal(header, "Bearer short-lived-jwt");
});
