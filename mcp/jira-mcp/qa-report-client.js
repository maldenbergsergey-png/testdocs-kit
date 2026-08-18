require("dotenv").config({ quiet: true });

const { QA_REPORT_URL } = process.env;

function configuredBaseUrl() {
  if (!QA_REPORT_URL) throw new Error("QA_REPORT_URL is required.");
  let url;
  try {
    url = new URL(QA_REPORT_URL);
  } catch {
    throw new Error("QA_REPORT_URL must be a valid HTTP(S) URL.");
  }
  if (!["http:", "https:"].includes(url.protocol)) {
    throw new Error("QA_REPORT_URL must use HTTP or HTTPS.");
  }
  return url.toString().replace(/\/+$/, "");
}

async function qaReportImportChecklist({ confirmed, title, issueUrl, content }) {
  if (confirmed !== true) {
    throw new Error("Explicit user confirmation is required to send a checklist to QA Report.");
  }
  if (typeof content !== "string" || !content.trim()) {
    throw new Error("content must contain non-empty Jira Wiki Markup.");
  }
  const endpoint = `${configuredBaseUrl()}/api/checklists/import`;
  let response;
  try {
    response = await fetch(endpoint, {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify({
        source: "testdocs-kit",
        format: "jira",
        ...(title ? { title } : {}),
        ...(issueUrl ? { issueKey: issueUrl } : {}),
        content
      })
    });
  } catch (error) {
    throw new Error(`QA Report network request failed for ${endpoint}: ${error.cause?.code || error.message}`);
  }
  const rawText = await response.text();
  let result;
  try {
    result = rawText ? JSON.parse(rawText) : {};
  } catch {
    throw new Error(`QA Report returned invalid JSON (${response.status}).`);
  }
  if (!response.ok) {
    throw new Error(`QA Report import failed (${response.status}): ${result.error || rawText.slice(0, 300)}`);
  }
  if (!result.ok || !result.checklistId || !result.url) {
    throw new Error("QA Report did not return the required checklistId and editor URL.");
  }
  let editorUrl;
  try {
    editorUrl = new URL(result.url);
  } catch {
    throw new Error("QA Report returned an invalid editor URL.");
  }
  if (!["http:", "https:"].includes(editorUrl.protocol)) {
    throw new Error("QA Report returned a non-HTTP(S) editor URL.");
  }
  return {
    ok: true,
    checklistId: String(result.checklistId),
    publicId: result.publicId ? String(result.publicId) : "",
    url: editorUrl.toString(),
    expiresAt: result.expiresAt,
    parsed: result.parsed,
    openMode: "external_browser_tab"
  };
}

module.exports = { qaReportImportChecklist };
