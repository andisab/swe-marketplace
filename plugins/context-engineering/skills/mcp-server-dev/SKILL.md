---
name: mcp-server-dev
description: >
  Create MCP servers — multi-tool services exposed via Model Context Protocol. Use this skill
  whenever users mention MCP servers, building servers, server scaffolding, tool registration,
  or want to package tools for distribution via uvx or npx. Also use when the conversation
  involves stdio transport, server lifecycle, or grouping multiple related tools into a service.
  Covers Python (FastMCP) and TypeScript (@modelcontextprotocol/sdk) patterns, packaging, and testing.

  Activate for:
  - "Create an MCP server"
  - "Build a server with multiple tools"
  - "Package tools for uvx/npx"
  - "Set up stdio transport"
  - "Register tools on a server"

  Do NOT use for:
  - Creating a single standalone tool function (use mcp-tool-dev)
  - General REST API development
  - Claude Code agents, skills, or commands
allowed-tools: Read, Write, Edit, Grep, Glob, Bash(mkdir:*, tree:*, ls:*), mcp__Conventions__search_conventions, mcp__Conventions__get_convention
---

# MCP Server Creation

Create multi-tool MCP servers in Python or TypeScript that follow the Model Context Protocol specification and Anthropic's tool design best practices.

## What MCP Servers Are

An MCP server is a process that exposes one or more tools (and optionally resources and prompts) over the Model Context Protocol. Servers communicate via stdio transport — they read JSON-RPC from stdin and write responses to stdout.

MCP servers are how you package and distribute tool capabilities. An LLM client (Claude Code, Claude Desktop, etc.) starts the server process and calls its tools.

## When to Create a Server

- You have **2+ related tools** that share configuration, state, or domain
- You want to **distribute tools** for others to use (via `uvx` or `npx`)
- Tools need **shared resources** (database connections, API clients, auth tokens)
- You're building a **domain-specific toolkit** (GitHub, database, monitoring, etc.)

## When NOT to Create a Server

- Single utility tool — use a standalone tool file (see `mcp-tool-dev` skill)
- Claude Code agent, skill, or command — use their respective creation skills
- REST API — MCP is for LLM tool calling, not general HTTP services

## Python vs TypeScript

| Factor | Python (FastMCP) | TypeScript (@modelcontextprotocol/sdk) |
|--------|-------------------|----------------------------------------|
| **Distribution** | `uvx` (uv tool) | `npx` |
| **Type system** | Type hints + docstrings | Zod schemas |
| **Packaging** | `pyproject.toml` | `package.json` with bin |
| **Async** | Native `async/await` | Native `async/await` |
| **Best for** | Data science, Python tooling, API wrappers | Frontend tooling, Node.js ecosystem, npm distribution |

Choose Python when the tools interact with Python libraries or you prefer pyproject.toml packaging. Choose TypeScript when targeting the npm ecosystem or when tools interact with Node.js libraries.

## Creation Workflow

### Step 1: Design Your Tools

List every tool with its name, description, parameters, and return format. Apply the consolidation principle: prefer fewer capable tools over many narrow ones.

For each tool, write the 3-4 sentence description (what, when to use, when NOT to use, behavior notes). This is the most important step — good descriptions prevent misuse.

### Step 2: Scaffold the Project

Use the templates as starting points:
- Python: `templates/mcp-server-python-template/`
- TypeScript: `templates/mcp-server-typescript-template/`

Core directory structure:

**Python:**
```
my-server/
├── pyproject.toml          # uvx entry point
├── src/my_server/
│   ├── __init__.py
│   ├── server.py           # FastMCP instance + tool registration
│   └── tools/              # One file per tool or tool group
│       └── search.py
├── tests/
│   ├── conftest.py
│   └── test_tools.py
└── README.md
```

**TypeScript:**
```
my-server/
├── package.json            # npx entry point with bin
├── tsconfig.json
├── src/
│   ├── index.ts            # Entry: CLI args, transport, shutdown
│   ├── server.ts           # Tool registration
│   └── tools/
│       └── search.ts
├── tests/
│   └── tools.test.ts
└── README.md
```

### Step 3: Implement Tools

Write each tool handler following the patterns in the language-specific reference:
- Python: `references/python-server-patterns.md`
- TypeScript: `references/typescript-server-patterns.md`

Key principles for all tools:
- Validate inputs at the top of every handler
- Return formatted text, not raw JSON dumps
- Include corrective guidance in error messages
- Keep handlers focused — one tool, one job

### Step 4: Configure Packaging

**Python (uvx):** Set `[project.scripts]` in `pyproject.toml`:
```toml
[project.scripts]
my-server = "my_server.server:main"
```

**TypeScript (npx):** Set `bin` in `package.json`:
```json
{
  "bin": { "my-server": "dist/index.js" }
}
```

### Step 5: Handle Server Lifecycle

Implement graceful shutdown (SIGINT/SIGTERM handling). This is critical for clean process termination when the client disconnects.

### Step 6: Write Tests

Test at three levels:
1. **Unit**: Import handler, call with dict, assert output
2. **Integration**: Start server, call tools via MCP client
3. **Schema validation**: Verify tool definitions match expected schemas

See `references/server-testing-guide.md` for detailed patterns.

## Tool Description Best Practices

- Write 3-4 sentences: what, when to use, when not to use, behavior notes
- Include parameter semantics in descriptions (regex vs full-text, format expectations)
- For 10+ tools, use discovery-first architecture: provide a `list_capabilities` tool

## Common Mistakes

1. **No graceful shutdown** — server hangs when client disconnects; always handle SIGINT/SIGTERM
2. **Stdout pollution** — logging or print() to stdout corrupts JSON-RPC; use stderr for logging
3. **Missing tool descriptions** — tools without descriptions are invisible to the LLM
4. **Monolithic handlers** — 200-line tool handlers; split logic into helper functions
5. **No packaging config** — forgetting `[project.scripts]` or `bin` entry; server can't be installed
6. **Ignoring transport** — MCP uses stdio, not HTTP; don't create an HTTP server

For detailed patterns per language, see the `references/` directory.
