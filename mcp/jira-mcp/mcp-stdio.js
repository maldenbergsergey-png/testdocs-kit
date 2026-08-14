const { McpServer } = require("@modelcontextprotocol/sdk/server/mcp.js");
const { StdioServerTransport } = require("@modelcontextprotocol/sdk/server/stdio.js");
const { z } = require("zod");

const { tools } = require("./jira-client");

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
       description: "Get a specific Zephyr Scale test case by key. Note: This internally fetches all test cases and finds the matching one due to API limitations.",
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

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
