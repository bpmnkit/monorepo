<div align="center">
  <img src="https://raw.githubusercontent.com/bpmnkit/monorepo/main/doc/logos/2026.svg" width="72" height="72" alt="BPMN Kit logo">
  <h1>@bpmnkit/cli</h1>
  <p>Command-line interface for Camunda 8 — deploy, manage, and monitor processes from the terminal</p>

  [![npm](https://img.shields.io/npm/v/@bpmnkit/cli?style=flat-square&color=6244d7)](https://www.npmjs.com/package/@bpmnkit/cli)
  [![license](https://img.shields.io/npm/l/@bpmnkit/cli?style=flat-square)](https://github.com/bpmnkit/monorepo/blob/main/LICENSE)
  [![typescript](https://img.shields.io/badge/TypeScript-strict-6244d7?style=flat-square&logo=typescript&logoColor=white)](https://github.com/bpmnkit/monorepo)

  [Website](https://bpmnkit.com) · [Documentation](https://docs.bpmnkit.com) · [GitHub](https://github.com/bpmnkit/monorepo) · [Changelog](https://github.com/bpmnkit/monorepo/blob/main/apps/cli/CHANGELOG.md)
</div>

---

## Overview

`@bpmnkit/cli` provides the `casen` command-line tool for interacting with Camunda 8 clusters. Manage profiles, deploy processes, run queries, and generate connector templates — all from your terminal.

## Installation

```sh
npm install -g @bpmnkit/cli
# or
pnpm add -g @bpmnkit/cli
```

## Quick Start

### Configure a profile

```sh
casen profile add my-cluster
# Interactive prompts for base URL and auth type
```

### Deploy a process

```sh
casen deploy order-process.bpmn
```

### List process instances

```sh
casen instances list --state active
```

## Commands

### Profile management

| Command | Description |
|---------|-------------|
| `casen profile list` | List all configured profiles |
| `casen profile add <name>` | Add a new profile (interactive) |
| `casen profile use <name>` | Switch the active profile |
| `casen profile remove <name>` | Delete a profile |

### Process & deployment

| Command | Description |
|---------|-------------|
| `casen deploy <file>` | Deploy a BPMN, DMN, or form file |
| `casen processes list` | List deployed process definitions |
| `casen instances list` | List process instances (--state filter) |
| `casen instances cancel <key>` | Cancel a running instance |

### Incidents & jobs

| Command | Description |
|---------|-------------|
| `casen incidents list` | List open incidents |
| `casen incidents resolve <key>` | Resolve an incident |
| `casen jobs list` | List active jobs |

### Connector generation

| Command | Description |
|---------|-------------|
| `casen connector generate <spec>` | Generate element templates from OpenAPI/Swagger |

## Global options

| Flag | Description |
|------|-------------|
| `--profile <name>` | Use a specific profile for this command |
| `--json` | Output as JSON (machine-readable) |
| `--help` | Show help |

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
| [`@bpmnkit/proxy`](https://www.npmjs.com/package/@bpmnkit/proxy) | Local AI bridge and Camunda API proxy server |

## License

[MIT](https://github.com/bpmnkit/monorepo/blob/main/LICENSE) © BPMN Kit — made by [u11g](https://u11g.com)
