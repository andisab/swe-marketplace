---
name: mcp-tool-dev
description: >
  Create MCP tools — individual tool functions exposed via Model Context Protocol. Use this
  skill whenever users mention MCP tools, tool handlers, tool functions, tool definitions,
  or want to add capabilities to an MCP server. Also use when the conversation involves
  designing tool schemas, writing tool descriptions, or implementing tool input validation.
  Covers FastMCP patterns, Anthropic tool description best practices, and testing strategies.

  Activate for:
  - "Create an MCP tool"
  - "Add a tool to my MCP server"
  - "Write a tool handler"
  - "Design a tool schema"
  - "Implement tool input validation"

  Do NOT use for:
  - Creating full MCP servers with multiple tools (use mcp-server-dev)
  - General API development without MCP
  - Claude Code slash commands or hooks
allowed-tools: Read, Write, Edit, Grep, Glob, mcp__Conventions__search_conventions, mcp__Conventions__get_convention
---

# MCP Tool Creation

Create individual MCP tool functions that follow Anthropic's tool design best practices and the Model Context Protocol specification.

## What MCP Tools Are

An MCP tool is a single function exposed via the Model Context Protocol that an LLM can invoke. Each tool has:
- **Name**: Verb-noun format (`search_documents`, `get_user`, `create_issue`)
- **Description**: 3-4 sentences explaining what the tool does, when to use it, and when not to
- **Input schema**: JSON Schema defining parameters with clear descriptions
- **Handler**: Async function that processes the input and returns MCP content blocks

Tools can be standalone (single-file utilities) or part of an MCP server (grouped related tools).

## When to Use This Skill

- Creating a single tool function for an existing or new MCP server
- Designing tool schemas and descriptions
- Implementing tool input validation and error handling
- Adding capabilities to a FastMCP server

## When NOT to Use

- Building a complete multi-tool MCP server from scratch — use `mcp-server-dev` instead
- Creating Claude Code agents, skills, or commands — use their respective creation skills

## Tool Anatomy

Every MCP tool consists of four parts:

### 1. Name
Use `snake_case` with verb-noun pattern. Be specific — `search_files_by_content` beats `search`.

### 2. Description
Write 3-4 sentences covering:
1. What the tool does (capability statement)
2. When to use it (primary use cases)
3. When NOT to use it (scope boundaries, suggest alternatives)
4. Key behavior notes (pagination, rate limits, return format)

Good descriptions prevent misuse and reduce wasted calls. Include parameter semantics — if "query" means regex vs full-text vs exact match, say so.

### 3. Input Schema
Define parameters using JSON Schema with:
- Clear `description` for each parameter explaining expected format and semantics
- `enum` constraints where values are known
- `default` values for optional parameters
- Required vs optional distinction

### 4. Handler Function
Async function that:
- Validates inputs early (fail fast with specific error messages)
- Returns MCP content blocks: `[{"type": "text", "text": "..."}]`
- Handles errors with corrective guidance (tell the caller what to do differently)

## Quick Reference: FastMCP Pattern (Primary)

```python
from mcp.server.fastmcp import FastMCP

mcp = FastMCP("my-server")

@mcp.tool()
async def search_documents(query: str, max_results: int = 10) -> str:
    """Search documents by content.

    Performs full-text search across all indexed documents. Use this tool
    when the user wants to find documents containing specific terms or phrases.
    Do not use for metadata-only searches — use list_documents with filters instead.

    Args:
        query: Full-text search query. Supports AND/OR operators.
        max_results: Maximum results to return (1-100, default 10).
    """
    if not query.strip():
        return "Error: query cannot be empty. Provide a search term."
    max_results = min(max(1, max_results), 100)
    results = await do_search(query, max_results)
    return format_results(results)
```

FastMCP infers the JSON Schema from the function signature and docstring. Type hints drive the schema; the docstring `Args:` section populates parameter descriptions.

## Creation Workflow

### Step 1: Design the Tool Interface

Define what the tool does before writing code:
- Name (verb_noun)
- 3-4 sentence description
- Parameters with types and descriptions
- Return format
- Error cases

### Step 2: Write the Schema

For FastMCP, the schema is implicit in the function signature. For manual schemas:

```python
TOOL_SCHEMA = {
    "name": "search_documents",
    "description": "Search documents by content...",
    "inputSchema": {
        "type": "object",
        "properties": {
            "query": {"type": "string", "description": "Full-text search query"},
            "max_results": {"type": "integer", "default": 10, "minimum": 1, "maximum": 100}
        },
        "required": ["query"]
    }
}
```

### Step 3: Implement the Handler

Write the async handler function. Key principles:
- Validate inputs at the top
- Keep handlers focused — one tool, one job
- Return structured text (markdown tables, JSON snippets) rather than raw data dumps
- Include context in error messages

### Step 4: Write Tests

Test the handler directly by calling it with a dict:

```python
async def test_search_documents():
    result = await search_documents("test query", max_results=5)
    assert "results" in result.lower() or isinstance(result, str)

async def test_search_documents_empty_query():
    result = await search_documents("")
    assert "error" in result.lower()
```

### Step 5: Validate

- Verify the tool appears in `tools/list` response
- Test with Claude to check description clarity
- Confirm error messages guide the caller to correct usage

## Template Reference

Use `templates/mcp-tool-template.py` as a starting point. It includes the FastMCP decorator pattern, input validation, content block returns, and error handling.

## Common Mistakes

1. **Vague descriptions** — "Does stuff with files" gives the LLM no guidance on when to call the tool
2. **Missing parameter descriptions** — parameters without descriptions force the LLM to guess semantics
3. **Generic error messages** — "Error occurred" wastes a tool call; "Query too long (max 500 chars), truncate and retry" helps recovery
4. **Returning raw data** — dumping an entire JSON response; instead format key fields into readable text
5. **Too many parameters** — more than 5-6 parameters signals the tool should be split
6. **No input validation** — trusting all inputs leads to cryptic downstream errors

For detailed SDK examples, Anthropic best practices, and real-world patterns, see `references/tool-design-patterns.md`.
