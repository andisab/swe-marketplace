# Tool Design Patterns Reference

Detailed SDK examples and Anthropic best practices for MCP tool creation.

---

## Table of Contents

1. [Anthropic Tool Description Best Practices](#anthropic-tool-description-best-practices)
2. [FastMCP Detailed Examples](#fastmcp-detailed-examples)
3. [Input Validation and JSON Schema](#input-validation-and-json-schema)
4. [Return Value Design](#return-value-design)
5. [Error Handling Patterns](#error-handling-patterns)
6. [Real-World Examples](#real-world-examples)

---

## Anthropic Tool Description Best Practices

Source: [Writing Tools for Agents](https://www.anthropic.com/engineering/writing-tools-for-agents), [Implement Tool Use](https://docs.anthropic.com/en/docs/build-with-claude/tool-use)

### Description Structure

Every tool description should contain 3-4 sentences:

1. **What**: Primary capability statement
2. **When to use**: Specific scenarios and trigger conditions
3. **When NOT to use**: Scope boundaries, alternative tools to suggest
4. **Behavior notes**: Pagination, rate limits, format details

### Good Description Example

```
Search the company knowledge base for documents matching a query. Returns
the top results with title, snippet, and relevance score. Use this when
the user asks about company policies, procedures, or internal documentation.
Do not use for web searches or external content — use web_search instead.
Results are paginated; set page_size to control batch size (default 10).
```

### Bad Description Example

```
Searches for stuff.
```

### Parameter Description Guidelines

- Explain the expected format: "ISO 8601 date string (e.g., 2024-01-15)"
- Clarify semantics: "query supports full-text search with AND/OR operators"
- Document constraints: "max_results must be between 1 and 100"
- Provide defaults: "Defaults to 'relevance' if not specified"

### Tool Consolidation

Prefer fewer, more capable tools over many narrow ones. Instead of `search_by_title`, `search_by_author`, `search_by_date`, create one `search_documents` tool with a `search_field` parameter. Claude handles fewer tools more reliably.

The exception: if two operations have fundamentally different parameter shapes or behaviors, keep them separate.

---

## FastMCP Detailed Examples

FastMCP (the `mcp` Python package) is the primary pattern for Python MCP tools.

### Basic Tool

```python
from mcp.server.fastmcp import FastMCP

mcp = FastMCP("document-tools")

@mcp.tool()
async def search_documents(
    query: str,
    max_results: int = 10,
    include_snippets: bool = True,
) -> str:
    """Search documents by content using full-text search.

    Returns matching documents with title, relevance score, and optional
    content snippets. Use when the user needs to find documents containing
    specific terms. Do not use for listing all documents — use list_documents.

    Args:
        query: Full-text search query. Supports AND/OR boolean operators.
        max_results: Number of results to return (1-100, default 10).
        include_snippets: Include content snippets in results (default True).
    """
    if not query.strip():
        return "Error: query cannot be empty. Provide at least one search term."

    max_results = min(max(1, max_results), 100)
    results = await perform_search(query, limit=max_results)

    if not results:
        return f"No documents found matching '{query}'. Try broader terms or check spelling."

    lines = [f"Found {len(results)} documents:\n"]
    for i, doc in enumerate(results, 1):
        lines.append(f"{i}. **{doc['title']}** (score: {doc['score']:.2f})")
        if include_snippets and doc.get("snippet"):
            lines.append(f"   {doc['snippet']}")
    return "\n".join(lines)
```

### Tool with Complex Input

```python
from typing import Literal

@mcp.tool()
async def create_issue(
    title: str,
    body: str,
    priority: Literal["low", "medium", "high", "critical"] = "medium",
    labels: list[str] | None = None,
    assignee: str | None = None,
) -> str:
    """Create a new issue in the project tracker.

    Creates an issue with the given title, body, and metadata. Use when the
    user wants to file a bug report, feature request, or task. Requires at
    minimum a title and body.

    Args:
        title: Issue title (max 200 characters).
        body: Detailed issue description in markdown.
        priority: Issue priority level. Defaults to medium.
        labels: Optional list of label names to apply.
        assignee: Optional username to assign the issue to.
    """
    if len(title) > 200:
        return f"Error: title too long ({len(title)} chars, max 200). Shorten the title."

    issue = await tracker.create(
        title=title, body=body, priority=priority,
        labels=labels or [], assignee=assignee,
    )
    return f"Created issue #{issue.id}: {issue.url}"
```

### Tool with Context (Lifespan Dependencies)

```python
from contextlib import asynccontextmanager
from mcp.server.fastmcp import FastMCP

@asynccontextmanager
async def lifespan(server: FastMCP):
    """Initialize shared resources."""
    db = await Database.connect(os.environ["DATABASE_URL"])
    try:
        yield {"db": db}
    finally:
        await db.close()

mcp = FastMCP("db-tools", lifespan=lifespan)

@mcp.tool()
async def query_table(ctx: Context, table: str, limit: int = 50) -> str:
    """Query a database table and return rows.

    Args:
        table: Table name to query (must exist in the schema).
        limit: Maximum rows to return (1-1000, default 50).
    """
    db = ctx.request_context.lifespan_context["db"]
    rows = await db.fetch(f"SELECT * FROM {table} LIMIT {limit}")
    return format_as_table(rows)
```

---

## Input Validation and JSON Schema

### Manual Schema Definition

When not using FastMCP's auto-inference:

```python
TOOL_DEFINITION = {
    "name": "search_documents",
    "description": "Search documents by content using full-text search...",
    "inputSchema": {
        "type": "object",
        "properties": {
            "query": {
                "type": "string",
                "description": "Full-text search query. Supports AND/OR operators.",
                "minLength": 1,
                "maxLength": 500,
            },
            "max_results": {
                "type": "integer",
                "description": "Maximum results to return (1-100).",
                "default": 10,
                "minimum": 1,
                "maximum": 100,
            },
            "format": {
                "type": "string",
                "description": "Output format for results.",
                "enum": ["brief", "detailed", "json"],
                "default": "brief",
            },
        },
        "required": ["query"],
    },
}
```

### Validation Patterns

```python
def validate_query(query: str) -> str | None:
    """Returns error message or None if valid."""
    if not query or not query.strip():
        return "Error: query cannot be empty. Provide at least one search term."
    if len(query) > 500:
        return f"Error: query too long ({len(query)} chars, max 500). Shorten your query."
    return None
```

---

## Return Value Design

MCP tools return content blocks. For FastMCP, return a plain string (the framework wraps it).

### Formatting Guidelines

- Use markdown for structured output (tables, headers, lists)
- Keep responses concise — summarize rather than dump
- Include counts and metadata upfront: "Found 15 results (showing top 10):"
- Use consistent formatting across tools in the same server

### Examples

**List results:**
```
Found 3 matching documents:

1. **API Authentication Guide** (score: 0.95)
   Covers OAuth2, API keys, and JWT token management.

2. **Rate Limiting Policy** (score: 0.82)
   Documents rate limits per endpoint and retry strategies.

3. **Error Codes Reference** (score: 0.71)
   Complete list of API error codes and meanings.
```

**Single result:**
```
Issue #142: Fix login timeout
Status: Open | Priority: High | Assignee: @jsmith
Created: 2024-01-15 | Labels: bug, auth
```

**Empty result:**
```
No documents found matching 'quantum computing'. Try broader terms
like 'computing' or check spelling.
```

---

## Error Handling Patterns

### Corrective Error Messages

Every error message should tell the caller what to do differently:

```python
# Bad
return "Error: invalid input"

# Good
return "Error: 'date' must be ISO 8601 format (e.g., '2024-01-15'). Got: 'January 15'"

# Bad
return "Not found"

# Good
return "No user found with username 'jsmith'. Verify the username or use search_users to find it."
```

### Error Categories

```python
# Validation error (caller can fix)
if not query.strip():
    return "Error: query cannot be empty. Provide at least one search term."

# Not found (informational, suggest next step)
if not results:
    return f"No results for '{query}'. Try broader terms or use list_all for a full listing."

# Rate limit (transient, suggest retry)
if rate_limited:
    return "Rate limited. Wait 30 seconds and retry, or reduce request frequency."

# Server error (not caller's fault)
try:
    result = await external_api.call(params)
except ExternalAPIError as e:
    return f"External service error: {e}. This is a server-side issue — retry in a few minutes."
```

---

## Real-World Examples

### External References

- [Anthropic MCP Servers](https://github.com/modelcontextprotocol/servers) — Official reference MCP server implementations
- FastMCP examples in the `mcp` Python package documentation
- TypeScript examples in the `@modelcontextprotocol/sdk` documentation
