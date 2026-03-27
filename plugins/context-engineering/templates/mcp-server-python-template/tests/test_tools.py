"""Unit tests for {server-name} tools.

Test each tool handler directly by calling the async function.
"""

from __future__ import annotations

import pytest

# Import your tool handlers
# from {server_module}.tools.example import example_tool


@pytest.mark.asyncio
async def test_example_tool_basic():
    """Tool returns a string result for valid input."""
    # result = await example_tool("test query", max_results=5)
    # assert isinstance(result, str)
    pass


@pytest.mark.asyncio
async def test_example_tool_empty_query():
    """Tool returns error for empty query."""
    # result = await example_tool("")
    # assert "error" in result.lower()
    pass


@pytest.mark.asyncio
async def test_example_tool_no_results():
    """Tool handles no results gracefully."""
    # result = await example_tool("nonexistent_xyz_123")
    # assert "no items" in result.lower()
    pass
