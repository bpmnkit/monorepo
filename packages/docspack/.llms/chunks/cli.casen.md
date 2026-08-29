# casen CLI

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

---
Source: https://bpmnkit.com/docs/cli/casen
