const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { validateSpSecret, getLastHttpDiagnostics } = require("../atlassian-http.cjs");

const sourceRoot = path.resolve(__dirname, "../..");
const codeHash = crypto.createHash("sha256");
for (const file of [__filename, path.join(__dirname, "jira-client.js"), path.join(__dirname, "mcp-stdio.js"), path.join(__dirname, "../atlassian-http.cjs"), path.join(__dirname, "../session-auth.cjs"), path.join(__dirname, "../read-relay.cjs"), path.join(__dirname, "../issue-routing.cjs")]) {
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
  let lastIssueRead = null;
  // Snapshot what this process loaded, not a config edited after it started.
  const { JIRA_URL, JIRA_AUTH_MODE, JIRA_PASSWORD_SESSION, JIRA_SP_SECRET = "", JIRA_CONNECTION_ID } = environment;
  let baseUrl = null;
  try {
    const parsed = new URL(JIRA_URL);
    if (["http:", "https:"].includes(parsed.protocol)) baseUrl = `${parsed.origin}${parsed.pathname.replace(/\/+$/, "")}`;
  } catch { /* Missing or invalid configuration is a diagnostic result. */ }
  let valid = true;
  try { validateSpSecret(JIRA_SP_SECRET); } catch { valid = false; }
  let issueReadUrl = baseUrl;
  if (environment.JIRA_READ_RELAY_URL) {
    issueReadUrl = null;
    try {
      const parsed = new URL(environment.JIRA_READ_RELAY_URL);
      if (["http:", "https:"].includes(parsed.protocol)) issueReadUrl = `${parsed.origin}${parsed.pathname.replace(/\/+$/, "")}`;
    } catch { /* Invalid settings expose no raw input. */ }
  }
  const connection = {
    id: JIRA_CONNECTION_ID || null,
    issueReadTransport: environment.JIRA_READ_RELAY_URL ? "read_relay" : "original",
    issueReadUrl,
    writeAndTmsTransport: "original",
    readFallback: [undefined, "", "none", "transient"].includes(environment.JIRA_READ_RELAY_FALLBACK)
      ? environment.JIRA_READ_RELAY_FALLBACK || "none" : "unsupported",
    baseUrl,
    authMode: ["basic", "bearer", "browser_session"].includes(JIRA_AUTH_MODE || "basic") ? JIRA_AUTH_MODE || "basic" : "unsupported",
    sessionReuse: JIRA_AUTH_MODE === "browser_session" ? "browser"
      : (JIRA_AUTH_MODE || "basic") === "basic" && JIRA_PASSWORD_SESSION === "1" ? "password" : "none",
    gatewayHeader: { name: "X-Sp-Secret", configured: Boolean(JIRA_SP_SECRET.trim()), valid }
  };
  const read = () => ({
    runtime,
    connection,
    lastHttpError: getLastHttpDiagnostics(),
    lastIssueRead: lastIssueRead ? { ...lastIssueRead } : null,
    networkRequestPerformed: false,
    serverPermissionsChecked: false
  });
  read.recordIssueRead = (transport, outcome) => {
    if (!["read_relay", "original", "original_fallback", "original_write_verification"].includes(transport) ||
        !["success", "failed"].includes(outcome)) throw new Error("Invalid local read observation.");
    lastIssueRead = { transport, outcome, observedAt: new Date().toISOString() };
  };
  return read;
}

module.exports = { createConnectionDiagnostics };
