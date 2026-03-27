# Python MCP Server Patterns

Detailed FastMCP examples and packaging patterns for Python MCP servers.

---

## Table of Contents

1. [FastMCP Server Setup](#fastmcp-server-setup)
2. [Tool Registration](#tool-registration)
3. [Lifespan and Shared Resources](#lifespan-and-shared-resources)
4. [Configuration Patterns](#configuration-patterns)
5. [Packaging with pyproject.toml](#packaging-with-pyprojecttoml)
6. [Error Handling and Shutdown](#error-handling-and-shutdown)
7. [Reference Implementations](#reference-implementations)

---

## FastMCP Server Setup

```python
"""My MCP server — provides tools for document management."""

from mcp.server.fastmcp import FastMCP

mcp = FastMCP(
    "my-server",
    version="1.0.0",
    description="Document management tools for searching, creating, and organizing documents.",
)
```

### Running the Server

```python
# At the bottom of server.py or in __main__.py
def main():
    """Entry point for uvx."""
    mcp.run(transport="stdio")

if __name__ == "__main__":
    main()
```

---

## Tool Registration

FastMCP infers JSON Schema from type hints and docstrings.

### Basic Tool

```python
@mcp.tool()
async def search_documents(query: str, max_results: int = 10) -> str:
    """Search documents by content.

    Performs full-text search across all indexed documents. Use when
    looking for documents containing specific terms or phrases. Do not
    use for metadata-only searches — use list_documents with filters.

    Args:
        query: Full-text search query. Supports AND/OR operators.
        max_results: Results to return (1-100, default 10).
    """
    ...
```

### Tool with Enum Parameters

```python
from typing import Literal

@mcp.tool()
async def list_documents(
    sort_by: Literal["title", "date", "relevance"] = "date",
    status: Literal["draft", "published", "archived"] | None = None,
    limit: int = 20,
) -> str:
    """List documents with optional filtering and sorting.

    Args:
        sort_by: Sort order for results.
        status: Filter by document status. None returns all.
        limit: Number of documents to return (1-100, default 20).
    """
    ...
```

### Tool with Complex Types

```python
@mcp.tool()
async def create_document(
    title: str,
    content: str,
    tags: list[str] | None = None,
    metadata: dict[str, str] | None = None,
) -> str:
    """Create a new document.

    Args:
        title: Document title (max 200 characters).
        content: Document body in markdown format.
        tags: Optional tags for categorization.
        metadata: Optional key-value metadata pairs.
    """
    if len(title) > 200:
        return f"Error: title too long ({len(title)} chars, max 200)."
    ...
```

---

## Lifespan and Shared Resources

Use lifespan for database connections, API clients, or other shared state.

```python
from contextlib import asynccontextmanager

@asynccontextmanager
async def lifespan(server: FastMCP):
    """Initialize and clean up shared resources."""
    import httpx
    client = httpx.AsyncClient(
        base_url=os.environ.get("API_BASE_URL", "https://api.example.com"),
        timeout=30.0,
    )
    try:
        yield {"client": client}
    finally:
        await client.aclose()

mcp = FastMCP("my-server", lifespan=lifespan)

@mcp.tool()
async def fetch_data(ctx: Context, endpoint: str) -> str:
    """Fetch data from the API.

    Args:
        endpoint: API endpoint path (e.g., "/users/123").
    """
    client = ctx.request_context.lifespan_context["client"]
    response = await client.get(endpoint)
    return response.text
```

---

## Configuration Patterns

### Environment Variables

```python
import os

# Required config
API_KEY = os.environ.get("MY_SERVER_API_KEY")
if not API_KEY:
    raise ValueError("MY_SERVER_API_KEY environment variable is required")

# Optional config with defaults
BASE_URL = os.environ.get("MY_SERVER_BASE_URL", "https://api.example.com")
TIMEOUT = float(os.environ.get("MY_SERVER_TIMEOUT", "30"))
MAX_RESULTS = int(os.environ.get("MY_SERVER_MAX_RESULTS", "100"))
```

### Config Class

```python
from dataclasses import dataclass

@dataclass
class ServerConfig:
    api_key: str
    base_url: str = "https://api.example.com"
    timeout: float = 30.0
    max_results: int = 100

    @classmethod
    def from_env(cls) -> "ServerConfig":
        api_key = os.environ.get("MY_SERVER_API_KEY")
        if not api_key:
            raise ValueError("MY_SERVER_API_KEY is required")
        return cls(
            api_key=api_key,
            base_url=os.environ.get("MY_SERVER_BASE_URL", cls.base_url),
            timeout=float(os.environ.get("MY_SERVER_TIMEOUT", str(cls.timeout))),
        )
```

---

## Packaging with pyproject.toml

```toml
[project]
name = "my-mcp-server"
version = "1.0.0"
description = "MCP server for document management"
readme = "README.md"
requires-python = ">=3.11"
dependencies = [
    "mcp>=1.0.0",
    "httpx>=0.27.0",
]

[project.scripts]
my-mcp-server = "my_mcp_server.server:main"

[build-system]
requires = ["hatchling"]
build-backend = "hatchling.build"

[tool.hatch.build.targets.wheel]
packages = ["src/my_mcp_server"]
```

### Installation

```bash
# Development
uv pip install -e .

# Distribution via uvx
uvx my-mcp-server

# Client configuration (claude_desktop_config.json)
{
    "mcpServers": {
        "my-server": {
            "command": "uvx",
            "args": ["my-mcp-server"],
            "env": {
                "MY_SERVER_API_KEY": "your-key-here"
            }
        }
    }
}
```

---

## Error Handling and Shutdown

### Graceful Shutdown

```python
import signal
import sys

def handle_shutdown(signum, frame):
    """Handle SIGINT/SIGTERM for clean shutdown."""
    sys.stderr.write("Shutting down server...\n")
    sys.exit(0)

signal.signal(signal.SIGINT, handle_shutdown)
signal.signal(signal.SIGTERM, handle_shutdown)
```

### Stderr Logging

MCP uses stdout for JSON-RPC. All logging must go to stderr:

```python
import logging
import sys

logging.basicConfig(
    stream=sys.stderr,
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
)
logger = logging.getLogger("my-server")
```

---

## Reference Implementations

### External

- [Anthropic MCP Servers](https://github.com/modelcontextprotocol/servers) — Official reference implementations
- `conventions-mcp` — Production TypeScript MCP server (`@ablukis/conventions-mcp` on npm)
