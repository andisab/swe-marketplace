# MCP Server Testing Guide

Testing patterns for MCP servers at unit, integration, and end-to-end levels.

---

## Table of Contents

1. [Unit Tests](#unit-tests)
2. [Integration Tests](#integration-tests)
3. [E2E Tests](#e2e-tests)
4. [Schema Validation](#schema-validation)
5. [Eval Best Practices](#eval-best-practices)

---

## Unit Tests

Test each tool handler in isolation by calling it directly with a dictionary of arguments.

### Python (pytest)

```python
"""tests/test_tools.py"""
import pytest

from my_server.tools.search import search_documents


@pytest.mark.asyncio
async def test_search_returns_results():
    result = await search_documents("test query", max_results=5)
    assert isinstance(result, str)
    assert "Found" in result or "No results" in result


@pytest.mark.asyncio
async def test_search_empty_query():
    result = await search_documents("")
    assert "error" in result.lower()
    assert "empty" in result.lower()


@pytest.mark.asyncio
async def test_search_clamps_max_results():
    result = await search_documents("test", max_results=999)
    # Should not crash; handler clamps to 100
    assert isinstance(result, str)


@pytest.mark.asyncio
async def test_search_no_results():
    result = await search_documents("nonexistent_xyz_123")
    assert "no results" in result.lower()
```

### TypeScript (vitest/jest)

```typescript
// tests/tools.test.ts
import { describe, it, expect } from "vitest";
import { handleSearchDocuments } from "../src/tools/search.js";

describe("search_documents", () => {
  it("returns results for valid query", async () => {
    const result = await handleSearchDocuments({ query: "test", max_results: 5 });
    expect(result.content).toBeDefined();
    expect(result.content[0].type).toBe("text");
  });

  it("returns error for empty query", async () => {
    const result = await handleSearchDocuments({ query: "" });
    expect(result.content[0].text.toLowerCase()).toContain("error");
  });

  it("handles missing optional params", async () => {
    const result = await handleSearchDocuments({ query: "test" });
    expect(result.content).toBeDefined();
  });
});
```

### Testing with Mocked Dependencies

```python
from unittest.mock import AsyncMock, patch

@pytest.mark.asyncio
async def test_search_with_mock_db():
    mock_results = [
        {"title": "Doc A", "score": 0.95, "snippet": "..."},
        {"title": "Doc B", "score": 0.80, "snippet": "..."},
    ]
    with patch("my_server.tools.search.perform_search", new_callable=AsyncMock) as mock:
        mock.return_value = mock_results
        result = await search_documents("test query")
        assert "Doc A" in result
        assert "Doc B" in result
        mock.assert_called_once_with("test query", limit=10)
```

---

## Integration Tests

Start the server and call tools via the MCP client library.

### Python

```python
"""tests/test_integration.py"""
import pytest
from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client


@pytest.fixture
async def client():
    """Create MCP client connected to the server."""
    server_params = StdioServerParameters(
        command="python",
        args=["-m", "my_server.server"],
    )
    async with stdio_client(server_params) as (read, write):
        async with ClientSession(read, write) as session:
            await session.initialize()
            yield session


@pytest.mark.asyncio
async def test_list_tools(client):
    """Verify all expected tools are registered."""
    result = await client.list_tools()
    tool_names = [t.name for t in result.tools]
    assert "search_documents" in tool_names
    assert "create_document" in tool_names


@pytest.mark.asyncio
async def test_call_tool(client):
    """Call a tool and verify response format."""
    result = await client.call_tool("search_documents", {"query": "test"})
    assert len(result.content) > 0
    assert result.content[0].type == "text"
```

---

## E2E Tests

Test with an actual MCP client session to verify tools work end-to-end.

```python
"""tests/test_e2e.py"""
import pytest

@pytest.mark.e2e
@pytest.mark.asyncio
async def test_tool_invocation_via_client():
    """Verify tools work end-to-end via MCP client."""
    from mcp import ClientSession, StdioServerParameters
    from mcp.client.stdio import stdio_client

    server_params = StdioServerParameters(
        command="python", args=["-m", "my_server.server"],
    )
    async with stdio_client(server_params) as (read, write):
        async with ClientSession(read, write) as session:
            await session.initialize()
            result = await session.call_tool("search_documents", {"query": "test"})
            assert len(result.content) > 0
```

---

## Schema Validation

Verify tool definitions have valid JSON Schemas.

```python
import json

def test_tool_schemas_are_valid():
    """Each tool must have name, description, and valid inputSchema."""
    # Import your tool definitions
    from my_server.server import mcp

    tools = mcp._tool_manager.list_tools()
    for tool in tools:
        assert tool.name, "Tool must have a name"
        assert len(tool.description) > 20, f"Tool '{tool.name}' description too short"
        assert tool.inputSchema.get("type") == "object", (
            f"Tool '{tool.name}' inputSchema must be type: object"
        )
        # Verify required params exist in properties
        required = tool.inputSchema.get("required", [])
        properties = tool.inputSchema.get("properties", {})
        for param in required:
            assert param in properties, (
                f"Tool '{tool.name}' requires '{param}' but it's not in properties"
            )
```

### TypeScript

```typescript
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";

describe("package.json", () => {
  const pkg = JSON.parse(readFileSync("package.json", "utf-8"));

  it("has bin entry", () => {
    expect(pkg.bin).toBeDefined();
  });

  it("has type module", () => {
    expect(pkg.type).toBe("module");
  });

  it("has MCP SDK dependency", () => {
    expect(pkg.dependencies["@modelcontextprotocol/sdk"]).toBeDefined();
  });
});
```

---

## Eval Best Practices

Based on Anthropic's "Demystifying Evals for AI Agents" guidance:

### Tool Description Evaluation

- Present the tool description to an LLM and ask it to explain when it would use the tool
- Compare the LLM's understanding with the intended use cases
- If there's a mismatch, the description needs improvement

### Functional Evaluation

Create test scenarios that verify:
1. **Correct tool selection**: Given a user request, does the LLM choose the right tool?
2. **Correct parameters**: Does the LLM fill parameters correctly?
3. **Error recovery**: When a tool returns an error, does the LLM adjust and retry?

### Rubric for Tool Quality

| Criterion | Weight | Check |
|-----------|--------|-------|
| Description clarity | 30% | LLM correctly identifies when to use/not use |
| Parameter accuracy | 25% | LLM fills params correctly on first try |
| Error guidance | 20% | Error messages enable recovery |
| Response format | 15% | Output is actionable, not raw data |
| Edge cases | 10% | Handles empty input, large input, missing params |
