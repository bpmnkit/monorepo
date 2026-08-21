# casen CLI — Worker commands

```sh
# Run a simple auto-complete worker (for testing)
casen worker payment-service

# Start scaffolded workers from ./workers/
casen worker start

# Start a specific scaffolded worker
casen worker start send-invoice
```


## MCP Server Mode

`casen` can act as an MCP (Model Context Protocol) server, exposing all cluster operations
as tools to Claude Desktop, Cursor, or any MCP client:

```sh
casen mcp
```

Configure in Claude Desktop (`claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "camunda": {
      "command": "casen",
      "args": ["mcp"],
      "env": {
        "CAMUNDA_CLIENT_ID": "...",
        "CAMUNDA_CLIENT_SECRET": "..."
      }
    }
  }
}
```

Now you can ask Claude: _"Show me the open incidents on the invoice-approval process"_ or
_"Resolve all incidents on process instance 2251799813685249"_.

---
Source: https://docs.bpmnkit.com/cli/casen/
