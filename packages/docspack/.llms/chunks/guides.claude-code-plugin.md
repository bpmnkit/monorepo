# Claude Code Plugin

The bpmnkit Claude Code plugin adds BPMN-aware slash commands, autonomous agents, and
ambient quality hooks directly into Claude Code. It's **CLI-first**: every skill drives
`casen` via Bash — no MCP server, no proxy daemon. Every process is authored as a
`ProcessPlan` JSON file and compiled deterministically by `casen synth`; no skill ever
writes BPMN XML by hand.


## Prerequisites

Install the BPMNKit CLI globally:

```sh
npm install -g @bpmnkit/cli
```

That's it — nothing else needs to be running.


## Installation

### Local (development or team)

```sh
claude --plugin-dir ./plugins-claude/bpmnkit-claude
```

Or add to your project's `.claude/settings.json`:

```json
{
  "plugins": [
    { "path": "./plugins-claude/bpmnkit-claude", "scope": "project" }
  ]
}
```

### Via marketplace

```sh
/plugin marketplace add github:bpmnkit/monorepo
/plugin install bpmnkit
```

---
Source: https://docs.bpmnkit.com/guides/claude-code-plugin/
