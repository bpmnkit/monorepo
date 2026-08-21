# casen CLI — AIKit Skills

`casen` ships four lightweight, CLI-only Claude Code slash commands (no MCP server, no proxy):

```sh
casen skills install
```

| Command | Description |
|---|---|
| `/implement <description>` | Write a plan, compile it, test it, scaffold workers, deploy |
| `/review <path>` | Run the full lint report and report a deploy-ready verdict |
| `/test <path>` | Run scenario tests and report path/branch coverage |
| `/deploy <path>` | Deploy-readiness gate, then deploy to local Reebe or Camunda 8 |

For the richer skill set (`/bpmnkit:implement`, `:extend`, `:agent`, `:connect`, plus generated reference docs), install the Claude Code plugin instead: `/plugin marketplace add github:bpmnkit/monorepo` then `/plugin install bpmnkit`. See [AIKit Skills](/cli/skills/) for full documentation.

---
Source: https://docs.bpmnkit.com/cli/casen/
