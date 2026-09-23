# AI Integration — MCP Server

BPMN Kit ships a Model Context Protocol (MCP) server that lets any MCP client — Claude Code,
Claude Desktop, Cursor, VS Code — create, validate, simulate and deploy processes. It speaks
stdio and is started by the CLI:

```sh
casen proxy mcp
```

or, without installing the CLI first, in an MCP client's configuration:

```json
{
  "mcpServers": {
    "bpmnkit": { "command": "npx", "args": ["-y", "@bpmnkit/cli", "proxy", "mcp"] }
  }
}
```

Each CLI release submits it to the [MCP Registry](https://registry.modelcontextprotocol.io)
as `io.github.bpmnkit/bpmnkit`.

Tools:

- `bpmn_create`, `bpmn_read`, `bpmn_update` — write and read `.bpmn` files through the compact
  format, with auto-layout applied on write
- `bpmn_validate` — run the optimizer's findings over a file
- `bpmn_simulate`, `bpmn_run_history` — run a process on the local engine and read past runs
  (needs the proxy running: `casen proxy start`)
- `bpmn_deploy` — deploy to the active `casen` profile (Camunda 8 or a local Reebe)
- `form_create`, `dmn_create` — Camunda Forms and DMN decision tables
- `worker_list`, `worker_scaffold` — list and generate job workers
- `pattern_list`, `pattern_get` — the domain patterns in `@bpmnkit/patterns`
- `camunda_search`, `camunda_execute` — discover and call any Camunda 8 REST operation

The [Claude Code plugin](/docs/guides/claude-code-plugin) configures this server for you.

---
Source: https://bpmnkit.com/docs/guides/ai
