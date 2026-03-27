# {Server Name}

{Description of what this MCP server does.}

## Tools

| Tool | Description |
|------|-------------|
| `example_tool` | Search for items matching a query |

## Setup

Before installing, rename the template placeholders:

1. Rename `src/server_name/` to `src/your_module_name/` (underscored Python module name)
2. In `pyproject.toml`, replace `{server-name}` with your CLI name (hyphenated, e.g., `my-server`)
3. In `pyproject.toml`, replace `{server_module}` with your module name (underscored, e.g., `my_server`)
4. Update imports in `tools/example.py` to match the new module name

> **Python packaging rule:** Hyphens in package names map to underscores in module names (e.g., `my-server` → `my_server`).

## Installation

```bash
# Via uvx
uvx {server-name}

# From source
uv pip install -e .
python -m {server_module}.server
```

## Configuration

Add to your MCP client config:

```json
{
  "mcpServers": {
    "{server-name}": {
      "command": "uvx",
      "args": ["{server-name}"],
      "env": {}
    }
  }
}
```

## Development

```bash
# Install dev dependencies
uv pip install -e ".[dev]"

# Run tests
pytest

# Type check
mypy src/
```
