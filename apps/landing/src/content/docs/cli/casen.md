---
title: casen CLI
description: Interactive TUI for managing Camunda 8 clusters from the terminal.
sidebar:
  order: 1
---

`casen` is an interactive terminal UI (TUI) for managing Camunda 8. Navigate with arrow keys,
no flags to memorize.

## Installation

```sh
pnpm add -g @bpmnkit/cli
```

## Quick Start

```sh
casen
```

The main menu appears. Use ↑ ↓ to navigate, Enter to select, Escape to go back.

## Navigation Structure

```
casen
├── generate        — generate or modify BPMN files without the TUI
│   └── bpmn        — templates, CompactDiagram JSON, or patch existing files
├── view            — view BPMN, DMN, and form files in the browser
│   ├── open        — any mix of .bpmn/.dmn/.form files or folders (auto-detect)
│   ├── bpmn        — BPMN diagrams rendered as SVG
│   ├── dmn         — DMN decision tables
│   └── form        — Camunda form layouts
├── lint            — static analysis and auto-fix for BPMN files
│   ├── lint        — run all checks, report findings
│   └── improve     — AI-assisted improvement suggestions
├── story           — render a BPMN process as a narrative HTML page
├── ask             — ask an AI assistant about your process or cluster
├── connector       — generate element templates from OpenAPI specs
│   ├── generate    — generate templates from a spec file or catalog entry
│   └── catalog     — list built-in catalog entries
├── profile         — manage connection profiles
│   ├── list        — show all profiles
│   ├── add         — create a new profile
│   └── switch      — set the active profile
├── process
│   ├── list        — list deployed process definitions
│   ├── start       — start a new instance
│   ├── instances   — list running instances
│   └── cancel      — cancel an instance
├── job
│   ├── list        — list active jobs
│   ├── complete    — complete a job
│   └── fail        — fail a job with a message
├── incident
│   ├── list        — list open incidents
│   └── resolve     — resolve an incident
├── decision
│   ├── list        — list deployed DMN decision tables
│   └── evaluate    — evaluate a decision with test inputs
├── variable
│   ├── list        — list variables for an instance
│   └── update      — set a variable value
├── message
│   └── publish     — publish a message for correlation
├── worker          — run job workers
│   ├── <job-type>  — auto-complete worker for a job type
│   └── start       — start scaffolded workers from ./workers/
├── proxy           — start the local AI bridge server
└── plugin          — manage CLI plugins
    ├── search      — discover plugins on npm
    ├── install     — install a plugin from npm or a local path
    ├── list        — list installed plugins
    ├── update      — update one or all plugins
    ├── remove      — uninstall a plugin
    └── info        — show details for an installed plugin
```

## Generate BPMN files

`casen generate bpmn` creates BPMN files from the command line — no interactive menu required.
Choose a built-in template, supply a full CompactDiagram JSON definition, or patch an existing file.

```sh
casen generate bpmn --template approval --process-id leave-request
casen generate bpmn --input order.bpmn --dump-compact   # inspect as JSON for AI
casen generate bpmn --input order.bpmn --patch '{"elements":[...],"flows":[...]}'
```

See [casen generate](/docs/cli/generate) for full documentation.

## View BPMN, DMN, and Form files

`casen view` opens a local browser-based viewer. Accepts individual files, folders, or a mix.

```sh
casen view bpmn ./processes/     # all .bpmn files in a folder
casen view dmn routing.dmn       # DMN decision table
casen view open ./project/       # any mix of .bpmn/.dmn/.form
```

See [casen view](/docs/cli/view) for full documentation.

## Connection Profiles

A profile stores the connection details for a Camunda cluster:

```sh
# Add a new profile
casen profile add

# You'll be prompted for:
# Name: my-saas-cluster
# Base URL: https://api.cloud.camunda.io
# Auth type: oauth2 | bearer | none
# Client ID, Client Secret, Audience, Token URL (for oauth2)
```

Profiles are saved to `~/.casen/profiles.json`.

## Common Workflows

### List process definitions

```
Navigate to: process → list → Enter

Result:
  bpmnProcessId                name                    ver
  ──────────────────────────────────────────────────────────
▶ invoice-approval              Invoice Approval          2
  order-fulfillment             Order Fulfillment         1
  customer-onboarding           Customer Onboarding       3
```

### Start a process instance

```
Navigate to: process → start → Enter

Select process: invoice-approval
Variables (JSON): {"invoiceId": "inv-001", "amount": 5000}
```

### Resolve an incident

```
Navigate to: incident → list → Enter
```

Select the incident with Enter, choose "Resolve" from the action menu.

### Publish a message

```
Navigate to: message → publish → Enter

Message name: payment-confirmed
Correlation key: ord-456
Variables (JSON): {"method": "card"}
```

## Plugins

casen's plugin system lets you extend the CLI with new command groups — your own organisation's
workflows, third-party integrations, or community-built tools.

### Discover plugins

```sh
# Browse all published casen plugins
casen plugin search

# Search by keyword
casen plugin search deploy
casen plugin search slack
```

Results are fetched live from the npm registry. Any package tagged with the `casen-plugin` keyword
appears here.

### Install a plugin

```sh
# Install from npm
casen plugin install casen-deploy

# Install a local plugin during development
casen plugin install ./my-plugin
```

Plugins are installed into `~/.casen/plugins/` and loaded automatically the next time casen starts.

### Manage installed plugins

```sh
# List installed plugins
casen plugin list

# Show full details for one plugin
casen plugin info casen-deploy

# Update a single plugin to the latest version
casen plugin update casen-deploy

# Update all installed plugins
casen plugin update

# Remove a plugin
casen plugin remove casen-deploy
```

Once installed, plugin commands appear in the main TUI and in tab-completion alongside built-in commands.

To build your own plugin, see [Plugin Authoring](/docs/cli/plugin-authoring).

## BPMN generation pipeline

Every BPMN process is authored as a `ProcessPlan` JSON file — never hand-written XML — and
compiled deterministically:

```sh
# Print the ProcessPlan JSON format reference (schema + field notes)
casen plan schema

# Compile a plan to laid-out, deployable BPMN
casen synth synth order-process.plan.json --output order-process.bpmn

# Extend an existing process: lift it back to plan form, then merge a delta plan into it
casen plan extract order-process.bpmn
casen synth synth delta.plan.json --merge order-process.bpmn --output order-process.bpmn

# Find and inspect a Camunda connector template
casen connector search slack
casen connector show io.camunda.connectors.Slack.v1

# Deploy-readiness gate, then deploy
casen lint lint order-process.bpmn --profile deploy
casen deploy deploy order-process.bpmn                   # local Reebe
casen deploy deploy order-process.bpmn --target camunda8 # active Camunda 8 profile
```

`casen synth` reports any problems keyed by JSON path in the plan (e.g. `steps[2].connector.values.token`) — fix the plan, never the XML, and re-run. If the plan has a `tests` array, `casen synth` also writes a `<file>.bpmn.tests.json` sidecar, runnable with `casen test <file>.bpmn`.

See [Building Processes with AI](/docs/guides/ai-implement) and [AI Agents](/docs/guides/ai-agents) for full walkthroughs.

## AIKit Skills

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

For the richer skill set (`/bpmnkit:implement`, `:extend`, `:agent`, `:connect`, plus generated reference docs), install the Claude Code plugin instead: `/plugin marketplace add github:bpmnkit/monorepo` then `/plugin install bpmnkit`. See [AIKit Skills](/docs/cli/skills) for full documentation.

## Worker commands

```sh
# Run a simple auto-complete worker (for testing)
casen worker payment-service

# Start scaffolded workers from ./workers/
casen worker start

# Start a specific scaffolded worker
casen worker start send-invoice
```

## Local engine (Reebe)

Reebe is a Zeebe-compatible workflow engine (~50 MB) that runs locally, so you can deploy
and run processes without a Camunda 8 cluster.

```sh
# Embedded SQLite, no external database
casen reebe start

# Custom port — match ZEEBE_ADDRESS, which defaults to http://localhost:26500
casen reebe start --port 26500

# PostgreSQL instead of the embedded database
casen reebe start --database-url postgres://user:pass@localhost/reebe
```

| Flag | Default | Description |
|---|---|---|
| `--port` | `8080` | HTTP port to listen on |
| `--database-url` | embedded SQLite | PostgreSQL connection URL |
| `--config` | `config.toml` | Path to the engine config file |

`casen reebe` on its own is shorthand for `casen reebe start`. The command runs the
`reebe-server` binary; build it with
`cargo install --path apps/reebe/crates/reebe-server` if it is not on your `PATH`.

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
