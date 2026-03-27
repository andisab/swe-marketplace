/**
 * {Server Name} MCP Server — Tool Registration
 *
 * Register all tools here. Each tool gets a name, description, Zod schema,
 * and async handler function.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

export const server = new McpServer({
  name: "{server-name}",
  version: "0.1.0",
});

// Import tool handlers
import { handleExampleTool } from "./tools/example.js";

// Register tools
server.tool(
  "example_tool",
  "Search for items matching a query. Returns matching items with name and " +
    "relevance score. Use when the user wants to find specific items by keyword. " +
    "Do not use for listing all items — use list_items instead.",
  {
    query: z
      .string()
      .min(1)
      .describe("Search query string. Supports basic keyword matching."),
    max_results: z
      .number()
      .min(1)
      .max(100)
      .default(10)
      .describe("Maximum results to return (1-100, default 10)."),
  },
  handleExampleTool
);
