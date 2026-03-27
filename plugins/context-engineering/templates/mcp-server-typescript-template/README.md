# {Server Name}

{Description of what this MCP server does.}

## Tools

| Tool | Description |
|------|-------------|
| `example_tool` | Search for items matching a query |

## Installation

```bash
# Via npx
npx @{scope}/{server-name}

# From source
npm install
npm run build
node dist/index.js
```

## Configuration

Add to your MCP client config:

```json
{
  "mcpServers": {
    "{server-name}": {
      "command": "npx",
      "args": ["-y", "@{scope}/{server-name}"],
      "env": {}
    }
  }
}
```

## Development

```bash
npm install
npm run dev        # Watch mode
npm test           # Run tests
npm run build      # Production build
```
