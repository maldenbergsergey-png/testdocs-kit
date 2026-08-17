const { McpServer } = require("@modelcontextprotocol/sdk/server/mcp.js");
const { StdioServerTransport } = require("@modelcontextprotocol/sdk/server/stdio.js");
const { z } = require("zod");

const { tools } = require("./jira-client");
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
  const createsEnabled = process.env.TESTDOCS_ENABLE_TEST_CASE_CREATION !== "0";
  const sessionCases = createSessionCaseRegistry();
  const server = new McpServer({
    name: "jira-mcp",
    version: "1.0.0"
  });

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
       description: "Search test cases in Zephyr Scale by project. Note: Maximum maxResults is 1000. Pagination via offset has limitations on this API.",
       inputSchema: z.object({
         projectId: z.string().min(1),
         fields: z.string().optional().describe("Comma-separated list of fields: id,key,name,status,projectId,folderId,priority,labels,owner,createdBy,createdOn,estimatedTime,scriptType,version"),
         query: z.string().optional().describe("TQL query string (e.g. 'name~\\\"%search term%\\\"')"),
         maxResults: z.number().int().positive().max(1000).optional().default(50),
         offset: z.number().int().min(0).optional().default(0).describe("Note: offset parameter may not work reliably on this API")
       })
     },
     async ({ projectId, fields, query, maxResults, offset }) =>
       toTextResult(await tools.zephyr_search_test_cases({ projectId, fields, query, maxResults, offset }))
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
       description: "Get a complete Zephyr Scale or legacy TM4J test case by key, including ordered testScript.steps when the connected installation exposes them. Falls back to explicitly marked metadata-only output when full-case retrieval is unavailable.",
       inputSchema: z.object({
         projectId: z.string().min(1),
         testCaseKey: z.string().min(1).describe("Test case key (e.g., 'APP-T123')")
       })
     },
     async ({ projectId, testCaseKey }) => toTextResult(await tools.zephyr_get_test_case({ projectId, testCaseKey }))
   );

   server.registerTool(
     "zephyr_get_all_test_cases",
     {
       description: "Get all test cases from a Zephyr Scale project. Returns up to 1000 test cases. This is useful for bulk operations or getting project overview.",
       inputSchema: z.object({
         projectId: z.string().min(1),
         fields: z.string().optional().describe("Comma-separated list of fields to return. Default: id,key,name,objective,precondition,status,priority,createdOn,updatedOn")
       })
     },
     async ({ projectId, fields }) => toTextResult(await tools.zephyr_get_all_test_cases({ projectId, fields }))
   );

  if (createsEnabled) {
    server.registerTool(
      "zephyr_create_test_case",
      {
        description: "Create one new Zephyr Scale Server/DC or compatible TM4J test case. Call only when the user explicitly asks to create or publish it now. This tool does not update existing cases. The folder must already exist; use '/' only when the user explicitly chooses the project root. Test data belongs to each step. In any step field, send two or more independent items as one '•' item per newline instead of flattening them with commas or semicolons.",
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
            editableThisSession: Boolean(key),
            sessionScope: "current_mcp_process"
          }
        });
      }
    );

    server.registerTool(
      "zephyr_update_session_test_case",
      {
        description: "Correct a Zephyr/TM4J test case only if this MCP process created it during the current session and the user explicitly asks to apply the correction. Previously existing, discovered, or created-in-another-session cases are rejected. Omitted fields are preserved. If steps are supplied, pass the complete final ordered step list because it replaces the current script. In any step field, send two or more independent items as one '•' item per newline.",
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
  }

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
