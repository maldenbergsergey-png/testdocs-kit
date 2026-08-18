const READ_PREFIXES = ["testops_find_", "testops_get_", "testops_list_"];

function buildMcpUrl(baseUrl) {
  if (!baseUrl) throw new Error("QA_TOOLS_URL is required");
  const parsed = new URL(baseUrl);
  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new Error("QA_TOOLS_URL must use HTTP or HTTPS");
  }
  parsed.hash = "";
  parsed.search = "";
  parsed.pathname = `${parsed.pathname.replace(/\/+$/, "")}/api/mcp`;
  return parsed;
}

function isReadTool(name) {
  return READ_PREFIXES.some((prefix) => name.startsWith(prefix));
}

function isDestructiveTool(name) {
  return /(^|_)delete(_|$)|(^|_)remove(_|$)/i.test(name);
}

function exposeTool(tool, writesEnabled) {
  if (isDestructiveTool(tool.name)) return null;
  if (isReadTool(tool.name)) return tool;
  if (!writesEnabled) return null;
  const inputSchema = tool.inputSchema && typeof tool.inputSchema === "object"
    ? structuredClone(tool.inputSchema)
    : { type: "object" };
  inputSchema.type ||= "object";
  inputSchema.properties ||= {};
  inputSchema.properties.confirmed = {
    type: "boolean",
    const: true,
    description: "Must be true only after the user explicitly approves this exact external change."
  };
  inputSchema.required = [...new Set([...(inputSchema.required || []), "confirmed"])];
  return {
    ...tool,
    description: `${tool.description || tool.name}\n\nTestdocs Kit: this changes external QA Tools data. Call it only after an explicit user request for this exact operation and pass confirmed: true.`,
    inputSchema
  };
}

function prepareCall(name, args, writesEnabled) {
  if (isDestructiveTool(name)) throw new Error(`Destructive QA Tools operation is not exposed: ${name}`);
  if (isReadTool(name)) return { name, arguments: args || {} };
  if (!writesEnabled) throw new Error(`QA Tools write operation is disabled in setup: ${name}`);
  if (args?.confirmed !== true) throw new Error(`QA Tools write operation requires confirmed: true: ${name}`);
  const forwarded = { ...(args || {}) };
  delete forwarded.confirmed;
  return { name, arguments: forwarded };
}

module.exports = { buildMcpUrl, exposeTool, isDestructiveTool, isReadTool, prepareCall };
