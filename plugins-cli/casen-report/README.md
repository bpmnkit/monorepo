<div align="center">
  <a href="https://bpmnkit.com"><img src="https://bpmnkit.com/favicon.svg" width="72" height="72" alt="BPMN Kit logo"></a>
  <h1>@bpmnkit/casen-report</h1>
  <p>Render HTML reports from Camunda 8 incident and SLA data</p>

  [![npm](https://img.shields.io/npm/v/@bpmnkit/casen-report?style=flat-square&color=6244d7)](https://www.npmjs.com/package/@bpmnkit/casen-report)
  [![license](https://img.shields.io/npm/l/@bpmnkit/casen-report?style=flat-square)](https://github.com/bpmnkit/monorepo/blob/main/LICENSE)
  [![typescript](https://img.shields.io/badge/TypeScript-strict-6244d7?style=flat-square&logo=typescript&logoColor=white)](https://github.com/bpmnkit/monorepo)

  [Website](https://bpmnkit.com) · [Documentation](https://docs.bpmnkit.com) · [GitHub](https://github.com/bpmnkit/monorepo) · [Changelog](https://github.com/bpmnkit/monorepo/blob/main/plugins-cli/casen-report/CHANGELOG.md)
</div>

---

## Overview

`casen-report` is an official `casen` CLI plugin that generates HTML reports from live Camunda 8 data. Install it once and run `casen report incidents` or `casen report sla` from any terminal.

## Installation

```sh
casen plugin install casen-report
```

## Commands

### `casen report incidents`

Fetch active incidents and render an HTML report grouped by process.

```sh
# Print table to stdout
casen report incidents

# Filter by process definition ID
casen report incidents --process-id order-process

# Write self-contained HTML file
casen report incidents --out incidents.html

# Limit fetch size
casen report incidents --limit 500 --out incidents.html
```

**Flags**

| Flag | Short | Description | Default |
|------|-------|-------------|---------|
| `--process-id` | `-p` | Filter by process definition ID | — |
| `--limit` | `-l` | Max incidents to fetch | 200 |
| `--out` | `-o` | Write HTML to this file path | — |

### `casen report sla`

Fetch process instances and generate an SLA compliance report. Instances whose duration exceeds the threshold are marked as **BREACHED**.

```sh
# Print table (30-minute SLA threshold)
casen report sla --threshold 30

# SLA report for a specific process, save to file
casen report sla --threshold 60 --process-id order-process --out sla.html
```

**Flags**

| Flag | Short | Description | Default |
|------|-------|-------------|---------|
| `--threshold` | `-t` | SLA threshold in minutes (required) | — |
| `--process-id` | `-p` | Filter by process definition ID | — |
| `--limit` | `-l` | Max instances to fetch | 200 |
| `--out` | `-o` | Write HTML to this file path | — |

## Report Format

HTML reports are self-contained single-file documents — no external CSS, no fonts to load. They use the BPMN Kit dark theme and include:

- **Summary stat cards** — totals, breach counts, compliance rate
- **Sortable data table** — all fetched rows with status badges
- **Generated timestamp** — so reports can be archived

---

## Related Packages

| Package | Description |
|---------|-------------|
| [`@bpmnkit/core`](https://www.npmjs.com/package/@bpmnkit/core) | BPMN/DMN/Form parser, builder, layout engine |
| [`@bpmnkit/canvas`](https://www.npmjs.com/package/@bpmnkit/canvas) | Zero-dependency SVG BPMN viewer |
| [`@bpmnkit/editor`](https://www.npmjs.com/package/@bpmnkit/editor) | Full-featured interactive BPMN editor |
| [`@bpmnkit/engine`](https://www.npmjs.com/package/@bpmnkit/engine) | Lightweight BPMN process execution engine |
| [`@bpmnkit/feel`](https://www.npmjs.com/package/@bpmnkit/feel) | FEEL expression language parser & evaluator |
| [`@bpmnkit/plugins`](https://www.npmjs.com/package/@bpmnkit/plugins) | 22 composable canvas plugins |
| [`@bpmnkit/api`](https://www.npmjs.com/package/@bpmnkit/api) | Camunda 8 REST API TypeScript client |
| [`@bpmnkit/ascii`](https://www.npmjs.com/package/@bpmnkit/ascii) | Render BPMN diagrams as Unicode ASCII art |
| [`@bpmnkit/ui`](https://www.npmjs.com/package/@bpmnkit/ui) | Shared design tokens and UI components |
| [`@bpmnkit/profiles`](https://www.npmjs.com/package/@bpmnkit/profiles) | Shared auth, profile storage, and client factories for CLI & proxy |
| [`@bpmnkit/operate`](https://www.npmjs.com/package/@bpmnkit/operate) | Monitoring & operations frontend for Camunda clusters |
| [`@bpmnkit/connector-gen`](https://www.npmjs.com/package/@bpmnkit/connector-gen) | Generate connector templates from OpenAPI specs |
| [`@bpmnkit/cli`](https://www.npmjs.com/package/@bpmnkit/cli) | Camunda 8 command-line interface (casen) |
| [`@bpmnkit/proxy`](https://www.npmjs.com/package/@bpmnkit/proxy) | Local AI bridge and Camunda API proxy server |
| [`@bpmnkit/cli-sdk`](https://www.npmjs.com/package/@bpmnkit/cli-sdk) | Plugin authoring SDK for the casen CLI |
| [`@bpmnkit/create-casen-plugin`](https://www.npmjs.com/package/@bpmnkit/create-casen-plugin) | Scaffold a new casen CLI plugin in seconds |
| [`@bpmnkit/casen-worker-http`](https://www.npmjs.com/package/@bpmnkit/casen-worker-http) | Example HTTP worker plugin — completes jobs with live JSONPlaceholder API data |
| [`@bpmnkit/casen-worker-ai`](https://www.npmjs.com/package/@bpmnkit/casen-worker-ai) | AI task worker — classify, summarize, extract, and decide using Claude |

## License

[MIT](https://github.com/bpmnkit/monorepo/blob/main/LICENSE) © BPMN Kit — made by [u11g](https://u11g.com)

<div align="center">
  <a href="https://bpmnkit.com"><img src="https://bpmnkit.com/favicon.svg" width="32" height="32" alt="BPMN Kit"></a>
</div>
