#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { ConfluenceClient, AuthMode } from "./confluence.js";

const CONFLUENCE_BASE_URL = process.env.CONFLUENCE_BASE_URL;
const CONFLUENCE_USERNAME = process.env.CONFLUENCE_USERNAME ?? "";
const CONFLUENCE_API_TOKEN = process.env.CONFLUENCE_API_TOKEN;
const CONFLUENCE_AUTH_MODE = (process.env.CONFLUENCE_AUTH_MODE ?? "basic") as AuthMode;
const CONFLUENCE_INSECURE_TLS = process.env.CONFLUENCE_INSECURE_TLS === "1";

if (!CONFLUENCE_BASE_URL || !CONFLUENCE_API_TOKEN) {
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
  CONFLUENCE_API_TOKEN,
  CONFLUENCE_AUTH_MODE
);

const server = new McpServer({
  name: "confluence",
  version: "1.0.0",
});

server.registerTool(
  "search",
  {
    title: "Search Confluence",
    description:
      "Search Confluence pages using CQL (Confluence Query Language). " +
      'Examples: \'title = "My Page"\', \'space = "DEV"\', \'type = "page" AND title ~ "api"\', \'ancestor = "12345"\'',
    inputSchema: {
      query: z
        .string()
        .describe(
          "CQL query string. Examples: 'title ~ \"keyword\"', 'space = \"DEV\"', 'type = \"page\" AND title ~ \"api\"'"
        ),
      limit: z
        .number()
        .optional()
        .describe("Maximum number of results to return (default: 10, max: 25)"),
    },
  },
  async ({ query, limit }) => {
    const results = await client.search(query, limit);
    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(results, null, 2),
        },
      ],
    };
  }
);

server.registerTool(
  "get_page",
  {
    title: "Get Confluence Page",
    description:
      "Read the content of a Confluence page by its ID. Returns the page title, body (HTML), and metadata.",
    inputSchema: {
      pageId: z.string().describe("Confluence page ID"),
      includeVersion: z
        .boolean()
        .optional()
        .describe("Include version information (default: false)"),
    },
  },
  async ({ pageId, includeVersion }) => {
    const page = await client.getPage(pageId, includeVersion);
    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(page, null, 2),
        },
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
    const page = await client.getPageAsMarkdown(pageId);
    return {
      content: [
        {
          type: "text" as const,
          text: page,
        },
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
    const pages = await client.getSpacePages(spaceKey, limit, start);
    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(pages, null, 2),
        },
      ],
    };
  }
);

server.registerTool(
  "get_page_children",
  {
    title: "Get Child Pages",
    description:
      "Get the child pages of a Confluence page. Useful for navigating page hierarchies.",
    inputSchema: {
      pageId: z.string().describe("Parent Confluence page ID"),
      limit: z
        .number()
        .optional()
        .describe("Maximum number of child pages to return (default: 25)"),
    },
  },
  async ({ pageId, limit }) => {
    const children = await client.getPageChildren(pageId, limit);
    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(children, null, 2),
        },
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
