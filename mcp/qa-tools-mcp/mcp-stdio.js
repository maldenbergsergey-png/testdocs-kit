const { Client } = require("@modelcontextprotocol/sdk/client/index.js");
const { StreamableHTTPClientTransport } = require("@modelcontextprotocol/sdk/client/streamableHttp.js");
const { Server } = require("@modelcontextprotocol/sdk/server/index.js");
const { StdioServerTransport } = require("@modelcontextprotocol/sdk/server/stdio.js");
const { CallToolRequestSchema, ListToolsRequestSchema } = require("@modelcontextprotocol/sdk/types.js");
const { buildMcpUrl, exposeTool, prepareCall } = require("./proxy-policy");
const { getAuthorizationHeader } = require("./auth");

async function main() {
  const writesEnabled = process.env.TESTDOCS_ENABLE_QA_TOOLS_WRITES === "1";
  const authorization = await getAuthorizationHeader();
  const upstream = new Client({ name: "testdocs-kit-qa-tools-proxy", version: "1.0.0" });
  const upstreamTransport = new StreamableHTTPClientTransport(buildMcpUrl(process.env.QA_TOOLS_URL), {
    requestInit: { headers: { Authorization: authorization } }
  });
  await upstream.connect(upstreamTransport);

  const server = new Server(
    { name: "testdocs-qa-tools-mcp", version: "1.0.0" },
    { capabilities: { tools: {} } }
  );
  let exposedNames = new Set();

  server.setRequestHandler(ListToolsRequestSchema, async () => {
    const result = await upstream.listTools();
    const tools = result.tools.map((tool) => exposeTool(tool, writesEnabled)).filter(Boolean);
    exposedNames = new Set(tools.map((tool) => tool.name));
    return { tools };
  });

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    if (!exposedNames.has(request.params.name)) {
      const result = await upstream.listTools();
      exposedNames = new Set(result.tools.map((tool) => exposeTool(tool, writesEnabled)).filter(Boolean).map((tool) => tool.name));
    }
    if (!exposedNames.has(request.params.name)) throw new Error(`QA Tools tool is not exposed: ${request.params.name}`);
    return upstream.callTool(prepareCall(request.params.name, request.params.arguments, writesEnabled));
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
