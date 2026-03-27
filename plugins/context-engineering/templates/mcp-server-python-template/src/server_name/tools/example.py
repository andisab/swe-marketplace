"""{Tool Group Name} tools.

Replace this module with your tool implementations. Each tool is registered
via the @mcp.tool() decorator from the parent server module.
"""

from __future__ import annotations

from ..server import mcp


@mcp.tool()
async def example_tool(query: str, max_results: int = 10) -> str:
    """Search for items matching the query.

    Returns matching items with name and relevance score. Use when the user
    wants to find specific items by keyword. Do not use for listing all items
    without a filter — use list_items instead.

    Args:
        query: Search query string. Supports basic keyword matching.
        max_results: Maximum results to return (1-100, default 10).
    """
    if not query or not query.strip():
        return "Error: query cannot be empty. Provide at least one search term."

    max_results = min(max(1, max_results), 100)

    # TODO: Replace with your implementation
    results: list[dict] = []

    if not results:
        return f"No items found matching '{query}'. Try broader terms."

    lines = [f"Found {len(results)} items:\n"]
    for i, item in enumerate(results, 1):
        lines.append(f"{i}. **{item['name']}** (score: {item.get('score', 'N/A')})")
    return "\n".join(lines)
