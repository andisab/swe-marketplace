# TypeScript MCP Server Patterns

Server creation, tool registration, and npx packaging with `@modelcontextprotocol/sdk`.

---

## Table of Contents

1. [Server Setup](#server-setup)
2. [Tool Registration](#tool-registration)
3. [Zod Schema Validation](#zod-schema-validation)
4. [Entry Point and Transport](#entry-point-and-transport)
5. [Packaging for npx](#packaging-for-npx)
6. [Error Handling](#error-handling)
7. [Reference Implementation](#reference-implementation)

---

## Server Setup

```typescript
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

const server = new McpServer({
  name: "my-server",
  version: "1.0.0",
  description: "Document management tools",
});
```

---

## Tool Registration

### Using server.tool()

```typescript
import { z } from "zod";

server.tool(
  "search_documents",
  "Search documents by content. Returns matching documents with title and relevance score. " +
    "Use when looking for documents containing specific terms. " +
    "Do not use for listing all documents — use list_documents instead.",
  {
    query: z.string().describe("Full-text search query. Supports AND/OR operators."),
    max_results: z.number().min(1).max(100).default(10)
      .describe("Maximum results to return (1-100, default 10)."),
  },
  async ({ query, max_results }) => {
    if (!query.trim()) {
      return {
        content: [{ type: "text", text: "Error: query cannot be empty." }],
      };
    }

    const results = await performSearch(query, max_results);
    return {
      content: [{ type: "text", text: formatResults(results) }],
    };
  }
);
```

### Using Request Handlers (Lower-Level)

```typescript
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "search_documents",
      description: "Search documents by content...",
      inputSchema: {
        type: "object" as const,
        properties: {
          query: { type: "string", description: "Full-text search query" },
          max_results: { type: "number", default: 10, minimum: 1, maximum: 100 },
        },
        required: ["query"],
      },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  switch (name) {
    case "search_documents":
      return await handleSearchDocuments(args);
    default:
      return {
        content: [{ type: "text", text: `Unknown tool: ${name}` }],
        isError: true,
      };
  }
});
```

---

## Zod Schema Validation

Zod provides runtime validation and automatic JSON Schema generation:

```typescript
import { z } from "zod";

const CreateIssueSchema = z.object({
  title: z.string().max(200).describe("Issue title (max 200 chars)"),
  body: z.string().describe("Issue description in markdown"),
  priority: z.enum(["low", "medium", "high", "critical"]).default("medium")
    .describe("Issue priority level"),
  labels: z.array(z.string()).optional()
    .describe("Labels to apply to the issue"),
  assignee: z.string().optional()
    .describe("Username to assign the issue to"),
});

server.tool(
  "create_issue",
  "Create a new issue in the project tracker...",
  CreateIssueSchema.shape,
  async (args) => {
    const validated = CreateIssueSchema.parse(args);
    // Use validated.title, validated.body, etc.
  }
);
```

---

## Entry Point and Transport

### index.ts

```typescript
#!/usr/bin/env node

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { server } from "./server.js";

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);

  // Handle graceful shutdown
  process.on("SIGINT", async () => {
    await server.close();
    process.exit(0);
  });

  process.on("SIGTERM", async () => {
    await server.close();
    process.exit(0);
  });
}

main().catch((error) => {
  console.error("Server failed to start:", error);
  process.exit(1);
});
```

The shebang `#!/usr/bin/env node` is required for npx execution.

### Stderr Logging

```typescript
// All logging must go to stderr (stdout is JSON-RPC)
console.error("[INFO] Server started");
console.error(`[ERROR] Tool failed: ${error.message}`);
```

---

## Packaging for npx

### package.json

```json
{
  "name": "@scope/my-mcp-server",
  "version": "1.0.0",
  "description": "MCP server for document management",
  "type": "module",
  "bin": {
    "my-mcp-server": "dist/index.js"
  },
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch",
    "start": "node dist/index.js"
  },
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.0.0",
    "zod": "^3.22.0"
  },
  "devDependencies": {
    "typescript": "^5.4.0",
    "@types/node": "^20.0.0"
  }
}
```

### tsconfig.json

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "Node16",
    "moduleResolution": "Node16",
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "declaration": true,
    "sourceMap": true,
    "esModuleInterop": true,
    "skipLibCheck": true
  },
  "include": ["src/**/*.ts"]
}
```

### Client Configuration

```json
{
  "mcpServers": {
    "my-server": {
      "command": "npx",
      "args": ["-y", "@scope/my-mcp-server"],
      "env": {
        "MY_SERVER_API_KEY": "your-key-here"
      }
    }
  }
}
```

---

## Error Handling

```typescript
server.tool("search_documents", "...", schema, async (args) => {
  try {
    const results = await performSearch(args.query);
    return {
      content: [{ type: "text", text: formatResults(results) }],
    };
  } catch (error) {
    if (error instanceof RateLimitError) {
      return {
        content: [{
          type: "text",
          text: `Rate limited. Retry after ${error.retryAfter} seconds.`,
        }],
        isError: true,
      };
    }
    return {
      content: [{
        type: "text",
        text: `Error searching documents: ${error.message}. Check query syntax.`,
      }],
      isError: true,
    };
  }
});
```

---

## Reference Implementation

### conventions-mcp

Production TypeScript MCP server (published on npm as `@ablukis/conventions-mcp`):
- Full `@modelcontextprotocol/sdk` implementation
- Fuzzy search, token management, progressive disclosure
- SSH/HTTPS Git auth, background sync
- Published on npm as `@ablukis/conventions-mcp`
- Demonstrates: tool registration, resource handlers, error patterns, npx packaging
