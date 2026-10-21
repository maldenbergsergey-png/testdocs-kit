const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { validateSpSecret, getLastHttpDiagnostics } = require("../atlassian-http.cjs");

const sourceRoot = path.resolve(__dirname, "../..");
const codeHash = crypto.createHash("sha256");
for (const file of [__filename, path.join(__dirname, "jira-client.js"), path.join(__dirname, "mcp-stdio.js"), path.join(__dirname, "../atlassian-http.cjs"), path.join(__dirname, "../session-auth.cjs")]) {
  codeHash.update(fs.readFileSync(file)).update("\0");
}
const runtime = {
  adapter: "jira-mcp",
  kitVersion: require("../../package.json").version,
  sourceRoot,
  loadedAt: new Date().toISOString(),
  codeHash: codeHash.digest("hex"),
  httpDiagnosticsVersion: 1
};

function createConnectionDiagnostics(environment) {
  // Snapshot what this process loaded, not a config edited after it started.
  const { JIRA_URL, JIRA_AUTH_MODE, JIRA_PASSWORD_SESSION, JIRA_SP_SECRET = "", JIRA_CONNECTION_ID } = environment;
  let baseUrl = null;
  try {
    const parsed = new URL(JIRA_URL);
    if (["http:", "https:"].includes(parsed.protocol)) baseUrl = `${parsed.origin}${parsed.pathname.replace(/\/+$/, "")}`;
  } catch { /* Missing or invalid configuration is a diagnostic result. */ }
  let valid = true;
  try { validateSpSecret(JIRA_SP_SECRET); } catch { valid = false; }
  const connection = {
    id: JIRA_CONNECTION_ID || null,
    baseUrl,
    authMode: ["basic", "bearer", "browser_session"].includes(JIRA_AUTH_MODE || "basic") ? JIRA_AUTH_MODE || "basic" : "unsupported",
    sessionReuse: JIRA_AUTH_MODE === "browser_session" ? "browser"
      : (JIRA_AUTH_MODE || "basic") === "basic" && JIRA_PASSWORD_SESSION === "1" ? "password" : "none",
    gatewayHeader: { name: "X-Sp-Secret", configured: Boolean(JIRA_SP_SECRET.trim()), valid }
  };
  return () => ({
    runtime,
    connection,
    lastHttpError: getLastHttpDiagnostics(),
    networkRequestPerformed: false,
    serverPermissionsChecked: false
  });
}

module.exports = { createConnectionDiagnostics };
