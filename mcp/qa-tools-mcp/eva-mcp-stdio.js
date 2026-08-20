const { Server } = require("@modelcontextprotocol/sdk/server/index.js");
const { StdioServerTransport } = require("@modelcontextprotocol/sdk/server/stdio.js");
const { CallToolRequestSchema, ListToolsRequestSchema } = require("@modelcontextprotocol/sdk/types.js");
const { EVA_TOOLS, callEvaTool } = require("./eva-api");

async function main() {
  if (!process.env.EVA_API_URL || !process.env.EVA_API_TOKEN) {
    throw new Error("EVA_API_URL and EVA_API_TOKEN are required");
  }
  const server = new Server(
    { name: "testdocs-eva-mcp", version: "1.0.0" },
    { capabilities: { tools: {} } }
  );
  const exposedNames = new Set(EVA_TOOLS.map((tool) => tool.name));
  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: EVA_TOOLS }));
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    if (!exposedNames.has(request.params.name)) {
      throw new Error(`Eva tool is not exposed by Testdocs Kit: ${request.params.name}`);
    }
    try {
      const result = await callEvaTool(request.params.name, request.params.arguments || {}, {
        baseUrl: process.env.EVA_API_URL,
        token: process.env.EVA_API_TOKEN
      });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    } catch (error) {
      return { content: [{ type: "text", text: error instanceof Error ? error.message : String(error) }], isError: true };
    }
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);
  const close = async () => { await server.close(); };
  process.once("SIGINT", close);
  process.once("SIGTERM", close);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
