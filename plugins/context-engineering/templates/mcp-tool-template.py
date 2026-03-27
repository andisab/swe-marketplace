"""MCP Tool Template — FastMCP Pattern.

Single-file MCP tool template using the FastMCP decorator pattern.
Replace {placeholders} with your implementation.

Usage:
    1. Copy this file to your server's tools/ directory
    2. Replace placeholders with your tool logic
    3. Import and register with your FastMCP server instance
    4. Test the handler directly (see test snippet below)

FastMCP auto-infers the JSON Schema from the function signature and
docstring Args section. Type hints drive the schema.
"""

from __future__ import annotations

from typing import Literal

from mcp.server.fastmcp import FastMCP

# If adding to an existing server, import the shared instance instead:
#   from .server import mcp
mcp = FastMCP("{server-name}")


# TODO: Rename your_tool_name to your tool (verb_noun, e.g., search_documents)
@mcp.tool()
async def your_tool_name(
    query: str,
    max_results: int = 10,
    output_format: Literal["brief", "detailed"] = "brief",
) -> str:
    """TODO: One-line summary of what this tool does.

    {2-3 sentences: when to use this tool, what it returns, and when NOT
    to use it (suggest the alternative tool instead).}

    Args:
        query: {What this parameter means, expected format, constraints.}
        max_results: Maximum number of results to return (1-100, default 10).
        output_format: Output detail level. "brief" returns titles only,
            "detailed" includes descriptions and metadata.
    """
    # --- Input validation (fail fast) ---
    if not query or not query.strip():
        return "Error: query cannot be empty. Provide at least one search term."

    max_results = min(max(1, max_results), 100)

    # --- Core logic ---
    # Replace with your implementation
    results = await _do_search(query, limit=max_results)

    # --- Empty result handling ---
    if not results:
        return (
            f"No results found for '{query}'. "
            "Try broader terms or check spelling."
        )

    # --- Format response ---
    lines = [f"Found {len(results)} results:\n"]
    for i, item in enumerate(results, 1):
        lines.append(f"{i}. **{item['title']}**")
        if output_format == "detailed" and item.get("description"):
            lines.append(f"   {item['description']}")
    return "\n".join(lines)


async def _do_search(query: str, limit: int) -> list[dict]:
    """Replace with your search implementation."""
    # Example placeholder
    return []


# --- Test snippet ---
# Run directly: python -m pytest {this_file} -v
#
# async def test_{tool_name}_basic():
#     result = await {tool_name}("test query", max_results=5)
#     assert isinstance(result, str)
#
# async def test_{tool_name}_empty_query():
#     result = await {tool_name}("")
#     assert "error" in result.lower()
#
# async def test_{tool_name}_no_results():
#     result = await {tool_name}("nonexistent_term_xyz")
#     assert "no results" in result.lower()
