async function getAuthorizationHeader(options = {}) {
  const baseUrl = options.baseUrl || process.env.QA_TOOLS_URL;
  const authMode = options.authMode || process.env.QA_TOOLS_AUTH_MODE || "api_token";
  const username = options.username || process.env.QA_TOOLS_USERNAME;
  const secret = options.secret || process.env.QA_TOOLS_TOKEN;
  const fetchImpl = options.fetchImpl || globalThis.fetch;
  if (!secret) throw new Error("QA_TOOLS_TOKEN is required");
  if (authMode === "api_token") return `Api-Token ${secret}`;
  if (authMode !== "password") throw new Error(`Unsupported QA Tools auth mode: ${authMode}`);
  if (!username) throw new Error("QA_TOOLS_USERNAME is required for password authentication");

  const form = new FormData();
  form.set("grant_type", "password");
  form.set("scope", "openid");
  form.set("username", username);
  form.set("password", secret);
  const response = await fetchImpl(`${String(baseUrl).replace(/\/+$/, "")}/api/uaa/oauth/token`, {
    method: "POST",
    headers: { Accept: "application/json", Expect: "" },
    body: form
  });
  const text = await response.text();
  let data;
  try { data = text ? JSON.parse(text) : {}; } catch { data = null; }
  if (!response.ok || !data?.access_token) {
    throw new Error(
      `QA Tools login/password authentication failed (${response.status}). ` +
      "Проверьте логин и пароль; если инстанс запрещает password grant для MCP, используйте персональный API-токен."
    );
  }
  return `Bearer ${data.access_token}`;
}

module.exports = { getAuthorizationHeader };
