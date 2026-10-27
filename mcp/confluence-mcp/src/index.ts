#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { ConfluenceClient, AuthMode } from "./confluence.js";

const CONFLUENCE_BASE_URL = process.env.CONFLUENCE_BASE_URL;
const CONFLUENCE_USERNAME = process.env.CONFLUENCE_USERNAME ?? "";
const CONFLUENCE_API_TOKEN = process.env.CONFLUENCE_API_TOKEN;
const CONFLUENCE_AUTH_MODE = (process.env.CONFLUENCE_AUTH_MODE ?? "basic") as AuthMode;
const CONFLUENCE_SESSION_FILE = process.env.CONFLUENCE_SESSION_FILE;
const CONFLUENCE_INSECURE_TLS = process.env.CONFLUENCE_INSECURE_TLS === "1";
const readRoute = process.env.CONFLUENCE_READ_RELAY_URL ? {
  url: process.env.CONFLUENCE_READ_RELAY_URL,
  tokenFile: process.env.CONFLUENCE_READ_RELAY_TOKEN_FILE || "",
  knowledgeSearchUrl: process.env.CONFLUENCE_KNOWLEDGE_SEARCH_URL || undefined,
  fallback: process.env.CONFLUENCE_READ_RELAY_FALLBACK || "none",
} : undefined;

if (!CONFLUENCE_BASE_URL || (CONFLUENCE_AUTH_MODE !== "browser_session" && !CONFLUENCE_API_TOKEN)) {
  console.error(
    "Missing required environment variables: CONFLUENCE_BASE_URL, CONFLUENCE_API_TOKEN"
  );
  process.exit(1);
}

if (CONFLUENCE_AUTH_MODE === "basic" && !CONFLUENCE_USERNAME) {
  console.error(
    "CONFLUENCE_USERNAME is required when CONFLUENCE_AUTH_MODE=basic"
  );
  process.exit(1);
}

if (CONFLUENCE_INSECURE_TLS) {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
}

const client = new ConfluenceClient(
  CONFLUENCE_BASE_URL,
  CONFLUENCE_USERNAME,
  CONFLUENCE_API_TOKEN ?? "",
  CONFLUENCE_AUTH_MODE,
  CONFLUENCE_SESSION_FILE,
  process.env.CONFLUENCE_SP_SECRET ?? "",
  process.env.CONFLUENCE_PASSWORD_SESSION === "1",
  readRoute,
);

const server = new McpServer({
  name: "confluence",
  version: "1.0.0",
}, { instructions: `Source: ${CONFLUENCE_BASE_URL}. Reads use ${readRoute ? `the relay first; configured same-instance fallback policy: ${readRoute.fallback}. The adapter alone selects any allowed fallback, never bootstrap or start a new login for fallback` : "the original connection"}. Do not add fallback outside this adapter. Resolve the intended instance before using numeric page IDs. Knowledge search returns discovery snippets; read the scoped original page before treating it as full requirements.` });

function routingNotes(transport: string) {
  return transport === "original_fallback" ? [{ type: "text" as const,
    text: "READ_TRANSPORT: original_fallback. The relay failed; this response came from the configured original wiki connection. No new login was started." }] : [];
}

const continuationSchema = {
  start: z.number().int().nonnegative().optional().describe("Start offset from nextStart (default: 0); omit when using cursor"),
  cursor: z.string().min(1).optional().describe("Opaque nextCursor returned by the previous batch; omit start"),
};

server.registerTool(
  "search",
  {
    title: "Search Confluence",
    description:
      "Search Confluence pages using CQL (Confluence Query Language). " +
      (readRoute?.knowledgeSearchUrl ? "For semantic knowledge discovery use mode semantic with the natural-language question in query; read original pages afterward. " : "") +
      "Use focused queries for related change pages in a confirmed space. Continue with nextStart/nextCursor while hasMore is true. " +
      'Examples: \'title = "My Page"\', \'space = "DEV"\', \'type = "page" AND title ~ "api"\', \'ancestor = "12345"\'',
    inputSchema: {
      ...(readRoute?.knowledgeSearchUrl ? { mode: z.enum(["cql", "semantic"]).optional().describe("Default cql; semantic returns knowledge discovery snippets") } : {}),
      query: z
        .string()
        .describe(
          "CQL query string. Examples: 'title ~ \"keyword\"', 'space = \"DEV\"', 'type = \"page\" AND title ~ \"api\"'"
        ),
      limit: z
        .number()
        .int().positive()
        .optional()
        .describe("Maximum number of results to return (default: 10, max: 25)"),
      ...continuationSchema,
    },
  },
  async ({ query, limit, start, cursor, mode }) => {
    if (start !== undefined && cursor !== undefined) throw new Error("Use either start or cursor, not both");
    if (mode === "semantic" && (start !== undefined || cursor !== undefined)) throw new Error("Semantic discovery does not accept CQL continuation");
    const { value: results, transport } = await client.withReadRouting<unknown>(() => mode === "semantic" ? client.searchKnowledge(query, limit) : client.search(query, limit, start, cursor));
    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(results, null, 2),
        },
        ...routingNotes(transport),
      ],
    };
  }
);

server.registerTool(
  "get_page",
  {
    title: "Get Confluence Page",
    description:
      "Read the content of a Confluence page by its ID. Returns title, body (HTML), space, ancestry and metadata. Use ancestry to identify the scoped base page when starting from a change document.",
    inputSchema: {
      pageId: z.string().describe("Confluence page ID"),
      includeVersion: z
        .boolean()
        .optional()
        .describe("Include version information (default: false)"),
    },
  },
  async ({ pageId, includeVersion }) => {
    const { value: page, transport } = await client.withReadRouting(() => client.getPage(pageId, includeVersion));
    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(page, null, 2),
        },
        ...routingNotes(transport),
      ],
    };
  }
);

server.registerTool(
  "get_page_as_markdown",
  {
    title: "Get Confluence Page as Markdown",
    description:
      "Read a Confluence page and return its content converted to Markdown for easier reading. " +
      "Useful when you need a clean text representation of the page.",
    inputSchema: {
      pageId: z.string().describe("Confluence page ID"),
    },
  },
  async ({ pageId }) => {
    const { value: page, transport } = await client.withReadRouting(() => client.getPageAsMarkdown(pageId));
    return {
      content: [
        {
          type: "text" as const,
          text: page,
        },
        ...routingNotes(transport),
      ],
    };
  }
);

server.registerTool(
  "get_space_pages",
  {
    title: "List Space Pages",
    description:
      "List pages in a Confluence space. Useful for discovering available documentation.",
    inputSchema: {
      spaceKey: z.string().describe("Confluence space key (e.g. 'DEV', 'DOCS')"),
      limit: z
        .number()
        .optional()
        .describe("Maximum number of pages to return (default: 25, max: 50)"),
      start: z
        .number()
        .optional()
        .describe("Start offset for pagination (default: 0)"),
    },
  },
  async ({ spaceKey, limit, start }) => {
    const { value: pages, transport } = await client.withReadRouting(() => client.getSpacePages(spaceKey, limit, start));
    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(pages, null, 2),
        },
        ...routingNotes(transport),
      ],
    };
  }
);

server.registerTool(
  "get_page_children",
  {
    title: "Get Child Pages",
    description:
      "List child pages, including change documents absent from the parent body. Read relevant pages separately. Continue with nextStart/nextCursor while hasMore is true; size is the batch count, total may be null.",
    inputSchema: {
      pageId: z.string().describe("Parent Confluence page ID"),
      limit: z
        .number()
        .int().positive()
        .optional()
        .describe("Maximum number of child pages to return (default: 25, max: 50)"),
      ...continuationSchema,
    },
  },
  async ({ pageId, limit, start, cursor }) => {
    if (start !== undefined && cursor !== undefined) throw new Error("Use either start or cursor, not both");
    const { value: children, transport } = await client.withReadRouting(() => client.getPageChildren(pageId, limit, start, cursor));
    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(children, null, 2),
        },
        ...routingNotes(transport),
      ],
    };
  }
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
