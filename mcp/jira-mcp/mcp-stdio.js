const { McpServer } = require("@modelcontextprotocol/sdk/server/mcp.js");
const { StdioServerTransport } = require("@modelcontextprotocol/sdk/server/stdio.js");
const { z } = require("zod");

const { tools } = require("./jira-client");
const { qaReportImportChecklist } = require("./qa-report-client");
const { createSessionCaseRegistry } = require("./session-case-registry");

function toTextResult(data) {
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(data, null, 2)
      }
    ]
  };
}

async function main() {
  const writesEnabled = process.env.TESTDOCS_ENABLE_WRITES === "1";
  const checklistCommentsEnabled = process.env.TESTDOCS_ENABLE_CHECKLIST_COMMENT_PUBLICATION === "1";
  const qaReportImportEnabled = process.env.TESTDOCS_ENABLE_QA_REPORT_IMPORT === "1";
  const deliveryOnly = process.env.TESTDOCS_DELIVERY_ONLY === "1";
  const createsEnabled = process.env.TESTDOCS_ENABLE_TEST_CASE_CREATION !== "0";
  const zephyrEnabled = (process.env.TESTDOCS_TMS_PROVIDER || "zephyr_scale") === "zephyr_scale";
  const sessionCases = createSessionCaseRegistry();
  const server = new McpServer({
    name: deliveryOnly ? "testdocs-delivery-mcp" : "jira-mcp",
    version: "1.0.0"
  });

  if (deliveryOnly) {
    if (qaReportImportEnabled) {
      server.registerTool(
        "qa_report_import_checklist",
        {
          description: "Send a reviewed Jira Wiki checklist to QA Report after an explicit user request. Returns a short-lived editor URL; open it only in a separate external browser tab/window when the user asks, never embed it. The payload is sent in the POST body, not in the URL.",
          inputSchema: z.object({
            confirmed: z.literal(true),
            title: z.string().min(1).max(300).optional(),
            issueUrl: z.string().url().max(2000).optional(),
            content: z.string().min(1)
          })
        },
        async (input) => toTextResult(await qaReportImportChecklist(input))
      );
    }
    const transport = new StdioServerTransport();
    await server.connect(transport);
    return;
  }

  server.registerTool(
    "get_issue",
    {
      description: "Get a Jira issue by key.",
      inputSchema: z.object({
        key: z.string().min(1)
      })
    },
    async ({ key }) => toTextResult(await tools.get_issue({ key }))
  );

  if (writesEnabled) {
    server.registerTool(
      "add_comment",
      {
        description: "Add a comment to a Jira issue.",
        inputSchema: z.object({
          key: z.string().min(1),
          comment: z.string().min(1)
        })
      },
      async ({ key, comment }) => toTextResult(await tools.add_comment({ key, comment }))
    );

    server.registerTool(
      "transition_issue",
      {
        description: "Move a Jira issue using a transition id.",
        inputSchema: z.object({
          key: z.string().min(1),
          transitionId: z.string().min(1)
        })
      },
      async ({ key, transitionId }) =>
        toTextResult(await tools.transition_issue({ key, transitionId }))
    );
  }

  if (checklistCommentsEnabled) {
    server.registerTool(
      "jira_publish_checklist_comment",
      {
        description: "Publish the exact reviewed checklist as a Jira issue comment only after the user explicitly asks to publish it. Accepts Jira Wiki Markup and converts it to ADF for Jira API v3. Does not edit or delete comments.",
        inputSchema: z.object({
          confirmed: z.literal(true),
          key: z.string().regex(/^[A-Za-z][A-Za-z0-9_]*-\d+$/),
          content: z.string().min(1)
        })
      },
      async (input) => toTextResult(await tools.jira_publish_checklist_comment(input))
    );
  }

  server.registerTool(
    "get_transitions",
    {
      description: "List available transitions for a Jira issue.",
      inputSchema: z.object({
        key: z.string().min(1)
      })
    },
    async ({ key }) => toTextResult(await tools.get_transitions({ key }))
  );

  server.registerTool(
    "search_issues",
    {
      description: "Search Jira issues with JQL.",
      inputSchema: z.object({
        jql: z.string().min(1),
        maxResults: z.number().int().positive().max(100).optional()
      })
    },
    async ({ jql, maxResults }) =>
      toTextResult(await tools.search_issues({ jql, maxResults }))
  );

  if (zephyrEnabled) {
  // --- Zephyr Scale tools ---

  server.registerTool(
    "zephyr_get_projects",
    {
      description: "List all projects in Zephyr Scale.",
      inputSchema: z.object({})
    },
    async () => toTextResult(await tools.zephyr_get_projects())
  );

  server.registerTool(
    "zephyr_get_project",
    {
      description: "Get Zephyr Scale project details by project ID.",
      inputSchema: z.object({
        projectId: z.string().min(1)
      })
    },
    async ({ projectId }) => toTextResult(await tools.zephyr_get_project({ projectId }))
  );

   server.registerTool(
     "zephyr_search_test_cases",
     {
       description: "Search test cases in Zephyr Scale only when discovery is needed. Use zephyr_get_test_case directly when a case key is known. Supply projectKey when known to use the compatible Server/DC API without an exploratory endpoint call. Do not repeat a failed search with equivalent parameters. Maximum maxResults is 1000.",
       inputSchema: z.object({
         projectId: z.string().min(1).optional().describe("Numeric project ID. Required only when projectKey is unavailable."),
         projectKey: z.string().min(1).optional().describe("Jira project key, preferred when known."),
         fields: z.string().optional().describe("Comma-separated list of fields: id,key,name,status,projectId,folderId,priority,labels,owner,createdBy,createdOn,estimatedTime,scriptType,version"),
         query: z.string().optional().describe("Additional valid TQL condition without the projectKey clause. Omit for a project listing; do not guess operators."),
         maxResults: z.number().int().positive().max(1000).optional().default(50),
         offset: z.number().int().min(0).optional().default(0).describe("Note: offset parameter may not work reliably on this API")
       }).refine((input) => Boolean(input.projectId || input.projectKey), {
         message: "projectId or projectKey is required."
       })
     },
     async ({ projectId, projectKey, fields, query, maxResults, offset }) =>
       toTextResult(await tools.zephyr_search_test_cases({ projectId, projectKey, fields, query, maxResults, offset }))
   );

  server.registerTool(
    "zephyr_get_test_plans",
    {
      description: "Get test plans for a Zephyr Scale project.",
      inputSchema: z.object({
        projectId: z.string().min(1),
        maxResults: z.number().int().positive().max(200).optional().default(50),
        offset: z.number().int().min(0).optional().default(0)
      })
    },
    async ({ projectId, maxResults, offset }) =>
      toTextResult(await tools.zephyr_get_test_plans({ projectId, maxResults, offset }))
  );

  server.registerTool(
    "zephyr_get_test_plan",
    {
      description: "Get a specific Zephyr Scale test plan by key.",
      inputSchema: z.object({
        testPlanKey: z.string().min(1)
      })
    },
    async ({ testPlanKey }) => toTextResult(await tools.zephyr_get_test_plan({ testPlanKey }))
  );

   server.registerTool(
     "zephyr_get_iterations",
     {
       description: "Get iterations (sprints) for a Zephyr Scale project.",
       inputSchema: z.object({
         projectId: z.string().min(1)
       })
     },
     async ({ projectId }) => toTextResult(await tools.zephyr_get_iterations({ projectId }))
   );

   server.registerTool(
     "zephyr_get_test_case",
     {
       description: "Get one complete Zephyr Scale or legacy TM4J test case directly by known key, including ordered testScript.steps and a full web URL when available. Do not search the library before calling this tool. Falls back internally to explicitly marked metadata-only output when full-case retrieval is unavailable.",
       inputSchema: z.object({
         projectId: z.string().min(1).optional().describe("Numeric project ID, needed only for metadata fallback on installations without direct full-case reads."),
         testCaseKey: z.string().min(1).describe("Test case key (e.g., 'APP-T123')")
       })
     },
     async ({ projectId, testCaseKey }) => toTextResult(await tools.zephyr_get_test_case({ projectId, testCaseKey }))
   );

   server.registerTool(
     "zephyr_get_all_test_cases",
     {
       description: "Get up to 1000 test cases for an explicitly requested project overview or bulk operation. Do not use this tool to find one known case key.",
       inputSchema: z.object({
         projectId: z.string().min(1).optional(),
         projectKey: z.string().min(1).optional(),
         fields: z.string().optional().describe("Comma-separated list of fields to return. Default: id,key,name,objective,precondition,status,priority,createdOn,updatedOn")
       }).refine((input) => Boolean(input.projectId || input.projectKey), {
         message: "projectId or projectKey is required."
       })
     },
     async ({ projectId, projectKey, fields }) => toTextResult(await tools.zephyr_get_all_test_cases({ projectId, projectKey, fields }))
   );

  if (createsEnabled) {
    server.registerTool(
      "zephyr_create_test_case",
      {
        description: "Create one new Zephyr Scale Server/DC or compatible TM4J test case. Call only when the user explicitly asks to create or publish it now. This tool does not update existing cases. The folder must already exist; use '/' only when the user explicitly chooses the project root. Put relevant requirement/design links in objective as [readable purpose](full https URL); the adapter converts them to clickable Zephyr rich-text links. Test data belongs to each step; omit testData when the step consumes none and never send 'Не требуется' or 'Не требуются'. Send two or more independent items as one '•' item per newline; the adapter converts those newlines to Zephyr-visible line breaks. The result includes _testdocs.webUrl when a case key is returned.",
        inputSchema: z.object({
          confirmed: z.literal(true).describe("Set true only after an explicit user request to create/publish this new case."),
          projectKey: z.string().min(1).describe("Target Jira project key, not numeric projectId."),
          folder: z.string().min(1).regex(/^\//).describe("Existing Zephyr folder path beginning with '/', or explicit root '/'."),
          name: z.string().min(1).max(255),
          objective: z.string().min(1).optional(),
          precondition: z.string().min(1).optional(),
          status: z.string().min(1).optional().describe("Raw case-sensitive TMS value only when its mapping is confirmed; otherwise omit."),
          priority: z.string().min(1).optional().describe("Raw case-sensitive TMS value only when confirmed; otherwise omit."),
          labels: z.array(z.string().min(1)).optional(),
          issueLinks: z.array(z.string().min(1)).optional(),
          customFields: z.record(
            z.string(),
            z.union([z.string(), z.number(), z.boolean()])
          ).optional().describe("Only confirmed custom-field names and values."),
          steps: z.array(z.object({
            description: z.string().min(1),
            testData: z.string().min(1).optional(),
            expectedResult: z.string().min(1)
          })).min(1)
        })
      },
      async (input) => {
        const result = await tools.zephyr_create_test_case(input);
        const key = sessionCases.recordCreated(result);
        return toTextResult({
          ...result,
          _testdocs: {
            ...(result?._testdocs || {}),
            editableThisSession: Boolean(key),
            sessionScope: "current_mcp_process"
          }
        });
      }
    );

    server.registerTool(
      "zephyr_update_session_test_case",
      {
        description: "Correct a Zephyr/TM4J test case only if this MCP process created it during the current session and the user explicitly asks to apply the correction. Previously existing, discovered, or created-in-another-session cases are rejected. Omitted fields are preserved. If steps are supplied, pass the complete final ordered step list because it replaces the current script; omit testData where no data is consumed and never send 'Не требуется' or 'Не требуются'. Send two or more independent items as one '•' item per newline; the adapter converts those newlines to Zephyr-visible line breaks. The result includes _testdocs.webUrl.",
        inputSchema: z.object({
          confirmed: z.literal(true).describe("Set true only after the user explicitly asks to apply this correction now."),
          testCaseKey: z.string().min(1).describe("Key returned by zephyr_create_test_case during this MCP session."),
          name: z.string().min(1).max(255).optional(),
          objective: z.string().optional().describe("Use an empty string only when the user explicitly asks to clear the objective."),
          precondition: z.string().optional().describe("Use an empty string only when the user explicitly asks to clear preconditions."),
          priority: z.string().min(1).optional().describe("Raw case-sensitive TMS value only when confirmed."),
          labels: z.array(z.string().min(1)).optional(),
          customFields: z.record(
            z.string(),
            z.union([
              z.string(),
              z.number(),
              z.boolean(),
              z.null(),
              z.array(z.union([z.string(), z.number(), z.boolean()]))
            ])
          ).optional().describe("Only confirmed custom-field names and values; include every affected required value."),
          steps: z.array(z.object({
            description: z.string().min(1),
            testData: z.string().min(1).optional(),
            expectedResult: z.string().min(1)
          })).min(1).optional().describe("Complete final ordered list. Supplying it replaces all existing steps in this just-created case.")
        }).refine(
          (input) => ["name", "objective", "precondition", "priority", "labels", "customFields", "steps"]
            .some((field) => Object.prototype.hasOwnProperty.call(input, field)),
          { message: "At least one editable field is required." }
        )
      },
      async (input) => {
        sessionCases.assertEditable(input.testCaseKey);
        return toTextResult(await tools.zephyr_update_session_test_case(input));
      }
    );

    server.registerTool(
      "zephyr_update_test_case",
      {
        description: "Update one previously existing Zephyr/TM4J test case only after the user explicitly asks to apply a reviewed proposal. expectedBaselineHash must come from _testdocs.contentHash of a complete zephyr_get_test_case response. The adapter re-reads the case immediately before PUT and rejects STALE_PROPOSAL on any mismatch. Omitted fields are preserved. If steps change, pass the complete final ordered list because it replaces the script. This tool cannot change folder, status, links, comments, versions, or delete/retire a case.",
        inputSchema: z.object({
          confirmed: z.literal(true).describe("Set true only after the user explicitly asks to apply the reviewed proposal now."),
          testCaseKey: z.string().min(1),
          expectedBaselineHash: z.string().regex(/^[a-f0-9]{64}$/).describe("Exact _testdocs.contentHash returned by the complete baseline read used for the proposal."),
          name: z.string().min(1).max(255).optional(),
          objective: z.string().optional(),
          precondition: z.string().optional(),
          priority: z.string().min(1).optional(),
          labels: z.array(z.string().min(1)).optional(),
          customFields: z.record(
            z.string(),
            z.union([z.string(), z.number(), z.boolean(), z.null(), z.array(z.union([z.string(), z.number(), z.boolean()]))])
          ).optional(),
          steps: z.array(z.object({
            description: z.string().min(1),
            testData: z.string().min(1).optional(),
            expectedResult: z.string().min(1)
          })).min(1).optional().describe("Complete final ordered list; supplying it replaces every current step.")
        }).refine(
          (input) => ["name", "objective", "precondition", "priority", "labels", "customFields", "steps"]
            .some((field) => Object.prototype.hasOwnProperty.call(input, field)),
          { message: "At least one editable field is required." }
        )
      },
      async (input) => toTextResult(await tools.zephyr_update_test_case(input))
    );
  }
  }

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
