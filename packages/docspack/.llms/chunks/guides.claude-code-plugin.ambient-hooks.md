# Claude Code Plugin — Ambient Hooks

The plugin installs two background hooks:

| Hook | Trigger | What it does |
|---|---|---|
| SessionStart | Every Claude Code session | Checks `casen` is installed |
| PostToolUse | After any Write or Edit | Silently lints any `.bpmn` file that was written |

The PostToolUse hook means every `.bpmn` file you (or Claude) writes is automatically
checked against the BPMNKit optimizer — zero extra steps.

---


## No MCP server required

Unlike earlier versions of this plugin, none of the skills above call an MCP tool — they
call `casen` directly via Bash. The separate `@bpmnkit/proxy` MCP server (`bpmn-aikit`)
still exists for Claude Desktop, Cursor, or other MCP-only hosts, but it's unrelated to
this plugin.

---
Source: https://bpmnkit.com/docs/guides/claude-code-plugin
