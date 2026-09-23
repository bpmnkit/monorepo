# casen CLI — MCP Server Mode

`casen proxy mcp` starts BPMN Kit's MCP (Model Context Protocol) server on stdio, so Claude
Code, Claude Desktop, Cursor or any MCP client can create, validate, simulate and deploy
processes, and call any Camunda 8 REST operation through `camunda_search` and
`camunda_execute`:

```sh
casen proxy mcp
```

Configure it in Claude Desktop (`claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "bpmnkit": {
      "command": "casen",
      "args": ["proxy", "mcp"]
    }
  }
}
```

The server uses the active `casen` profile for cluster calls; set one with `casen profile`
first, or pass `ZEEBE_ADDRESS`, `ZEEBE_CLIENT_ID` and `ZEEBE_CLIENT_SECRET` in `env`. The
full tool list is in the [AI guide](/docs/guides/ai#mcp-server).

Now you can ask Claude: _"Show me the open incidents on the invoice-approval process"_ or
_"Resolve all incidents on process instance 2251799813685249"_.

---
Source: https://bpmnkit.com/docs/cli/casen
