#!/usr/bin/env node

/**
 * {Server Name} MCP Server — Entry Point
 *
 * Handles CLI arguments, transport setup, and graceful shutdown.
 * Tool registration is in ./server.ts.
 */

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { server } from "./server.js";

async function main(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);

  console.error(`[INFO] {server-name} started`);

  // Graceful shutdown
  const shutdown = async () => {
    console.error("[INFO] Shutting down...");
    await server.close();
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((error) => {
  console.error("[FATAL] Server failed to start:", error);
  process.exit(1);
});
