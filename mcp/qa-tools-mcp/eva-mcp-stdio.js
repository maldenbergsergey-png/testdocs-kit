const { Client } = require("@modelcontextprotocol/sdk/client/index.js");
const { StdioClientTransport } = require("@modelcontextprotocol/sdk/client/stdio.js");
const { Server } = require("@modelcontextprotocol/sdk/server/index.js");
const { StdioServerTransport } = require("@modelcontextprotocol/sdk/server/stdio.js");
const { CallToolRequestSchema, ListToolsRequestSchema } = require("@modelcontextprotocol/sdk/types.js");
const { exposeEvaTool } = require("./eva-policy");

function cleanEnvironment(values) {
  return Object.fromEntries(Object.entries(values).filter(([, value]) => typeof value === "string"));
}

async function main() {
  const command = process.env.EVA_MCP_COMMAND || "evateamclient-mcp";
  if (!process.env.EVA_API_URL || !process.env.EVA_API_TOKEN) {
    throw new Error("EVA_API_URL and EVA_API_TOKEN are required");
  }
  const upstream = new Client({ name: "testdocs-kit-eva-proxy", version: "1.0.0" });
  await upstream.connect(new StdioClientTransport({
    command,
    args: [],
    env: cleanEnvironment({
      ...process.env,
      EVA_API_URL: process.env.EVA_API_URL,
      EVA_API_TOKEN: process.env.EVA_API_TOKEN
    })
  }));

  const server = new Server(
    { name: "testdocs-eva-mcp", version: "1.0.0" },
    { capabilities: { tools: {} } }
  );
  let exposedNames = new Set();
  async function listExposed() {
    const result = await upstream.listTools();
    const tools = result.tools.map(exposeEvaTool).filter(Boolean);
    exposedNames = new Set(tools.map((tool) => tool.name));
    return tools;
  }
  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: await listExposed() }));
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    if (!exposedNames.size) await listExposed();
    if (!exposedNames.has(request.params.name)) {
      throw new Error(`Eva tool is not exposed by Testdocs Kit: ${request.params.name}`);
    }
    return upstream.callTool({ name: request.params.name, arguments: request.params.arguments || {} });
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);
  const close = async () => { await Promise.allSettled([server.close(), upstream.close()]); };
  process.once("SIGINT", close);
  process.once("SIGTERM", close);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
