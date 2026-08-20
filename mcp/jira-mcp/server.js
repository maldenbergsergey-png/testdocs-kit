const express = require("express");
require("dotenv").config();

const { tools } = require("./jira-client");
const { createSessionCaseRegistry } = require("./session-case-registry");

const app = express();
const { PORT = 3333 } = process.env;
const writesEnabled = process.env.TESTDOCS_ENABLE_WRITES === "1";
const checklistCommentsEnabled = process.env.TESTDOCS_ENABLE_CHECKLIST_COMMENT_PUBLICATION === "1";
const bugCreationEnabled = process.env.TESTDOCS_ENABLE_BUG_CREATION === "1";
const writeTools = new Set(["add_comment", "transition_issue"]);
const createsEnabled = process.env.TESTDOCS_ENABLE_TEST_CASE_CREATION !== "0";
const createTools = new Set(["zephyr_create_test_case", "zephyr_update_session_test_case", "zephyr_update_test_case"]);
const sessionCases = createSessionCaseRegistry();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get("/", (req, res) => {
  res.send("Jira MCP server is running");
});

app.post("/mcp", async (req, res) => {
  try {
    const { tool, params } = req.body || {};

    if (!tool) {
      return res.status(400).json({ error: "tool is required" });
    }

    if (!tools[tool]) {
      return res.status(400).json({ error: `Unknown tool: ${tool}` });
    }

    if (writeTools.has(tool) && !writesEnabled) {
      return res.status(403).json({
        error: "Write tools are disabled. Set TESTDOCS_ENABLE_WRITES=1 only after explicit approval."
      });
    }

    if (tool === "jira_publish_checklist_comment" && !checklistCommentsEnabled) {
      return res.status(403).json({
        error: "Checklist comment publication is disabled."
      });
    }

    if (tool === "jira_create_bug" && !bugCreationEnabled) {
      return res.status(403).json({
        error: "Jira bug creation is disabled."
      });
    }

    if (createTools.has(tool) && !createsEnabled) {
      return res.status(403).json({
        error: "Test-case creation and guarded updates are disabled."
      });
    }

    if (tool === "zephyr_update_session_test_case") {
      sessionCases.assertEditable(params?.testCaseKey);
    }

    const result = await tools[tool](params || {});
    if (tool === "zephyr_create_test_case") {
      sessionCases.recordCreated(result);
    }
    return res.json({ result });
  } catch (err) {
    return res.status(500).json({
      error: err.message
    });
  }
});

app.use((err, req, res, next) => {
  if (err instanceof SyntaxError && err.status === 400 && "body" in err) {
    return res.status(400).json({
      error: `Invalid JSON body: ${err.message}`
    });
  }

  return next(err);
});

app.listen(PORT, () => {
  console.log(`Jira HTTP wrapper is running on http://localhost:${PORT}`);
});
