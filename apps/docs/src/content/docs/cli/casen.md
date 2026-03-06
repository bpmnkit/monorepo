---
title: casen CLI
description: Interactive TUI for managing Camunda 8 clusters from the terminal.
---

`casen` is an interactive terminal UI (TUI) for managing Camunda 8. Navigate with arrow keys,
no flags to memorize.

## Installation

```sh
pnpm add -g casen
```

## Quick Start

```sh
casen
```

The main menu appears. Use ↑ ↓ to navigate, Enter to select, Escape to go back.

## Navigation Structure

```
casen
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
└── message
    └── publish     — publish a message for correlation
```

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
