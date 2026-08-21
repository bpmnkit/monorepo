# AI Integration — MCP Server

BPMN Kit ships with a Model Context Protocol (MCP) server that exposes process editing
tools to any MCP-compatible AI client (Claude Desktop, Cursor, etc.):

```sh
# Start the MCP server
casen mcp
```

Available MCP tools:
- `get_diagram` — returns the current diagram as CompactDiagram JSON
- `update_diagram` — applies a CompactDiagram diff
- `add_service_task` — adds a single service task with Zeebe config
- `add_http_call` — adds a pre-configured Camunda HTTP connector task
- `apply_layout` — re-runs auto-layout on the current diagram
- `validate` — validates the diagram and returns any schema errors

---
Source: https://docs.bpmnkit.com/guides/ai/
