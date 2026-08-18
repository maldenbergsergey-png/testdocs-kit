const test = require("node:test");
const assert = require("node:assert/strict");
const { exchangeApiTokenForBearer, getAuthorizationHeader } = require("./auth");

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
      const nativeRequest = new Request(url, options);
      assert.match(nativeRequest.headers.get("content-type"), /^application\/x-www-form-urlencoded/);
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

test("reports a safe OAuth reason when password grant is rejected", async () => {
  await assert.rejects(
    getAuthorizationHeader({
      baseUrl: "https://qa-tools.company.example",
      authMode: "password",
      username: "tester",
      secret: "secret-that-must-not-leak",
      fetchImpl: async () => ({
        ok: false,
        status: 401,
        text: async () => JSON.stringify({ error: "invalid_grant", error_description: "Bad credentials" })
      })
    }),
    (error) => {
      assert.match(error.message, /invalid_grant: Bad credentials/);
      assert.doesNotMatch(error.message, /secret-that-must-not-leak/);
      return true;
    }
  );
});

test("exchanges an API token for a bearer fallback without leaking it", async () => {
  let request;
  const header = await exchangeApiTokenForBearer({
    baseUrl: "https://qa-tools.company.example/",
    secret: "personal-token",
    fetchImpl: async (url, options) => {
      assert.doesNotThrow(() => new Request(url, options));
      request = { url, options };
      return {
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ access_token: "fallback-jwt" })
      };
    }
  });
  assert.equal(request.url, "https://qa-tools.company.example/api/uaa/oauth/token");
  assert.equal(request.options.body.get("grant_type"), "apitoken");
  assert.equal(request.options.body.get("token"), "personal-token");
  assert.equal(new Headers(request.options.headers).has("expect"), false);
  assert.equal(header, "Bearer fallback-jwt");
});
