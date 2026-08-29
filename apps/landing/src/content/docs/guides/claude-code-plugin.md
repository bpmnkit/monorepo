---
title: Claude Code Plugin
description: Install the bpmnkit plugin for Claude Code to get AI-first BPMN development and operations — generate diagrams, wire connectors, deploy, and resolve incidents from natural language.
sidebar:
  order: 10
---

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

## Configuration

When the plugin is enabled, Claude Code prompts for two optional values:

| Config key | Description |
|---|---|
| `camunda_endpoint` | Camunda 8 REST API endpoint (leave blank for local Reebe) |
| `camunda_token` | Camunda 8 OAuth2 token (leave blank for local Reebe) |

Leave both blank to use the local [Reebe engine](/docs/cli/casen#local-engine-reebe).

---

## Skills

### `/bpmnkit:implement <description>`

The main entry point — natural language to a compiled, tested BPMN process.

```
/bpmnkit:implement order fulfillment with payment and inventory check
/bpmnkit:implement employee onboarding process with HR approval
```

Resolves connectors, writes a `ProcessPlan`, compiles it with `casen synth`, tests it,
scaffolds any missing workers, and asks where to deploy.

---

### `/bpmnkit:extend <file> <change request>`

Extend an existing process from a natural-language change.

```
/bpmnkit:extend order-fulfillment.bpmn add a timeout boundary on the payment step
```

Lifts the process to plan form (`casen plan extract`), writes a small delta plan, and
merges it in (`casen synth --merge`) — the summary is at the element level, not an XML diff.

---

### `/bpmnkit:agent [file] <description>`

Design and add a Camunda AI Agent Sub-process.

```
/bpmnkit:agent add a support-triage agent with tools: search KB (http), escalate to human (user task)
```

Works out the provider/model, prompts, and tools (each mapped via connector search or an
existing worker job type), then compiles and mock-tests the agent step. See
[AI Agents](/docs/guides/ai-agents) for the full pattern.

---

### `/bpmnkit:connect <file> <step> <service>`

Wire an existing plan step to an external system via a Camunda connector template.

```
/bpmnkit:connect order-fulfillment.bpmn notify_ops slack
```

---

### `/bpmnkit:review [file.bpmn]`

Run the full static analyzer and report deploy-readiness.

```
/bpmnkit:review
/bpmnkit:review order-fulfillment.bpmn
```

Reports findings grouped by severity and ends with an explicit "Deploy-ready: yes/no" verdict.

---

### `/bpmnkit:test [file.bpmn]`

Run scenario tests and report path/branch coverage.

```
/bpmnkit:test
/bpmnkit:test order-fulfillment.bpmn
```

---

### `/bpmnkit:deploy [file.bpmn] [--local|--camunda]`

Gate on deploy-readiness, then deploy to local Reebe or Camunda 8.

```
/bpmnkit:deploy
/bpmnkit:deploy order-fulfillment.bpmn --camunda
```

---

### `/bpmnkit:instances [process-id] [--active|--failed]`

List running process instances.

```
/bpmnkit:instances
/bpmnkit:instances order-process --failed
```

---

### `/bpmnkit:incidents [--process-id X]`

List open incidents with suggested resolution actions.

```
/bpmnkit:incidents
/bpmnkit:incidents --process-id order-process
```

---

## Reference docs

Every skill reads the relevant reference doc before authoring a plan:

| File | Contents |
|---|---|
| `references/plan-format.md` | The `ProcessPlan` JSON schema + annotated, tested examples |
| `references/connectors.md` | The 116-template Camunda connector catalog index |
| `references/agentic.md` | The AI Agent Sub-process pattern, binding keys, a full example |
| `references/feel.md` | FEEL syntax crib sheet + the `"="`-means-expression convention |
| `references/modeling-style.md` | Camunda naming/structure conventions |

---

## Agents

### `process-builder`

Builds a complete BPMN process end-to-end from a description. Invoke directly:

```
Build me an invoice approval process for accounts payable
```

**What it does:**

1. Asks clarifying questions (error paths, user tasks, deploy target)
2. Checks domain patterns (`casen pattern list`/`get`)
3. Resolves connectors, writes the plan
4. Compiles it with `casen synth`
5. Shows a preview and **waits for your approval**
6. Tests the process, fixing failures by adjusting the plan
7. Scaffolds a worker stub for every job type with no connector
8. Gates on `casen lint --profile deploy`, then deploys to the chosen target
9. Reports the process ID, files created, and next steps

---

### `incident-resolver`

Triages and resolves open Camunda incidents. Invoke directly:

```
Investigate and resolve the open incidents
```

**What it does:**

1. Fetches all open incidents (`casen incident list`)
2. Groups by process + error type, sorted by count
3. Investigates root cause per group
4. **Proposes a fix and waits for your approval** before executing
5. Executes approved fixes (retry jobs, resolve incidents, migrate instances)
6. Verifies the count dropped
7. Reports a resolution summary

---

## Ambient Hooks

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
