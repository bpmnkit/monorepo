# BPMNKit Claude Code Plugin

AI-first BPMN development and operations for Claude Code — implement, extend, and deploy Camunda 8 processes from natural language, without ever hand-writing BPMN XML.

## Prerequisites

```sh
npm install -g @bpmnkit/cli
```

That's it — this plugin is **CLI-first**: every skill drives `casen` via Bash. No MCP server, no proxy daemon, no nested LLM required. (The `@bpmnkit/proxy` MCP server still exists separately for Studio/other AI hosts — it's unrelated to this plugin.)

## Installation

**From marketplace:**

```sh
/plugin marketplace add github:bpmnkit/monorepo
/plugin install bpmnkit
```

**Local (development or team):**

```sh
claude --plugin-dir ./plugins-claude/bpmnkit-claude
```

## Configuration

On first enable, Claude Code prompts for two optional values:

| Key | Description |
|-----|-------------|
| `camunda_endpoint` | Camunda 8 REST API endpoint — leave blank for local Reebe |
| `camunda_token` | Camunda 8 OAuth2 token — leave blank for local Reebe |

## Skills

| Skill | What it does |
|-------|--------------|
| `/bpmnkit:implement <description>` | Natural language → plan → compiled, tested `.bpmn` — the main entry point |
| `/bpmnkit:extend <file> <change>` | Lift an existing process to a plan, apply a targeted delta, merge |
| `/bpmnkit:agent [file] <description>` | Design and add a Camunda AI Agent Sub-process (model, prompts, tools) |
| `/bpmnkit:connect <file> <step> <service>` | Wire an existing step to an external system via a connector template |
| `/bpmnkit:review [file]` | Full static analysis, grouped by severity, with an explicit deploy-ready verdict |
| `/bpmnkit:test [file]` | Run scenario tests, report path/branch coverage |
| `/bpmnkit:deploy [file] [--local\|--camunda]` | Deploy-readiness gate, then deploy to Reebe or Camunda 8 |
| `/bpmnkit:instances [id] [--active\|--failed]` | List running process instances |
| `/bpmnkit:incidents [--process-id X]` | List open incidents with suggested actions |

Every skill that writes or changes a process goes through the same pipeline: **plan JSON → `casen synth` → compiled, laid-out BPMN.** No skill ever hand-writes BPMN XML, element IDs, or connector property keys — grep the plugin for `bpmndi`/`<bpmn:` and you'll find none.

## Reference docs (read by skills, useful to read yourself)

| File | Contents |
|------|----------|
| `references/plan-format.md` | The `ProcessPlan` JSON schema + annotated, tested examples |
| `references/connectors.md` | The 116-template Camunda connector catalog index + how to apply one |
| `references/agentic.md` | The AI Agent Sub-process pattern — binding keys, `fromAi()`, a full example |
| `references/feel.md` | FEEL syntax crib sheet + the `"="`-means-expression convention |
| `references/modeling-style.md` | Camunda naming/structure conventions for generated processes |

`references/connectors.md`, `references/feel.md`, and `references/plan-format.md` are generated — regenerate with `node scripts/generate-skill-references.mjs` from the monorepo root after changing the connector catalog, FEEL builtins, or the plan schema summary.

## Agents

**`process-builder`** — describe a process, get a deployed process + worker stubs:

> "Build me an invoice approval process for accounts payable"

Steps: clarify → resolve connectors → write plan → compile → **preview (approval gate)** → test → scaffold workers → **lint gate** → deploy → summary.

**`incident-resolver`** — triage and resolve open incidents:

> "Investigate and resolve the open incidents"

Steps: fetch → group by type → investigate root cause → **propose fix (approval gate)** → execute → verify → summary.

## Hooks

- **SessionStart** — checks `casen` is installed
- **PostToolUse** — silently lints any `.bpmn` file written during the session

## Structure

```
.claude-plugin/
  plugin.json       manifest
  marketplace.json  marketplace entry
references/
  connectors.md     GENERATED — connector catalog index
  agentic.md         hand-written — AI Agent Sub-process pattern
  feel.md            GENERATED — FEEL syntax + builtins
  plan-format.md     GENERATED — ProcessPlan schema + examples
  modeling-style.md  extracted — naming/structure conventions
skills/
  implement/        /bpmnkit:implement
  extend/           /bpmnkit:extend
  agent/            /bpmnkit:agent
  connect/          /bpmnkit:connect
  review/           /bpmnkit:review
  test/             /bpmnkit:test
  deploy/           /bpmnkit:deploy
  instances/        /bpmnkit:instances
  incidents/        /bpmnkit:incidents
agents/
  process-builder.md
  incident-resolver.md
hooks/
  hooks.json        SessionStart + PostToolUse
```

## Full documentation

[bpmnkit.com/guides/claude-code-plugin](https://bpmnkit.com/guides/claude-code-plugin)
