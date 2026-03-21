<div align="center">
  <a href="https://bpmnkit.com"><img src="https://bpmnkit.com/favicon.svg" width="72" height="72" alt="BPMN Kit logo"></a>
  <h1>@bpmnkit/casen-worker-http</h1>
  <p>Example casen worker plugin — processes HTTP connector jobs using the JSONPlaceholder API</p>

  [![npm](https://img.shields.io/npm/v/@bpmnkit/casen-worker-http?style=flat-square&color=6244d7)](https://www.npmjs.com/package/@bpmnkit/casen-worker-http)
  [![license](https://img.shields.io/npm/l/@bpmnkit/casen-worker-http?style=flat-square)](https://github.com/bpmnkit/monorepo/blob/main/LICENSE)
  [![typescript](https://img.shields.io/badge/TypeScript-strict-6244d7?style=flat-square&logo=typescript&logoColor=white)](https://github.com/bpmnkit/monorepo)

  [Website](https://bpmnkit.com) · [Documentation](https://docs.bpmnkit.com) · [GitHub](https://github.com/bpmnkit/monorepo) · [Changelog](https://github.com/bpmnkit/monorepo/blob/main/plugins-cli/casen-worker-http/CHANGELOG.md)
</div>

---

## Overview

`casen-worker-http` is an official `casen` CLI plugin that demonstrates the worker plugin pattern. It subscribes to `io.camunda.connector.HttpJson:1` jobs and completes each one with live data fetched from the [JSONPlaceholder](https://jsonplaceholder.typicode.com/) API — useful for quickly testing a Camunda worker setup without writing any integration code.

## Installation

```sh
casen plugin install casen-worker-http
```

## Usage

Start the worker from the TUI or directly from the command line:

```sh
# Interactive TUI
casen http-worker

# CLI foreground mode (Ctrl+C to stop)
casen http-worker start
```

## What it does

For every activated job the worker:

1. Picks a random user ID (1–10) and fetches `https://jsonplaceholder.typicode.com/users/{id}`
2. Completes the job with the following variables:

| Variable | Source |
|---|---|
| `userId` | `user.id` |
| `name` | `user.name` |
| `email` | `user.email` |
| `city` | `user.address.city` |
| `company` | `user.company.name` |
| `inputVariables` | Original job variables |
| `processedAt` | ISO 8601 timestamp |

## Building your own worker plugin

Use this package as a starting point. The key API is `createWorkerCommand` from `@bpmnkit/cli-sdk`:

```typescript
import { createWorkerCommand, type CasenPlugin } from "@bpmnkit/cli-sdk"

const plugin: CasenPlugin = {
  id: "com.example.my-worker",
  name: "My Worker",
  version: "1.0.0",
  groups: [{
    name: "my-worker",
    description: "Process my-job jobs",
    commands: [createWorkerCommand({
      jobType: "my-job",
      async processJob(job) {
        return { result: "processed", input: job.variables }
      },
    })],
  }],
}
export default plugin
```

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
| [`@bpmnkit/casen-report`](https://www.npmjs.com/package/@bpmnkit/casen-report) | HTML reports from Camunda 8 incident and SLA data |
| [`@bpmnkit/casen-worker-ai`](https://www.npmjs.com/package/@bpmnkit/casen-worker-ai) | AI task worker — classify, summarize, extract, and decide using Claude |

## License

[MIT](https://github.com/bpmnkit/monorepo/blob/main/LICENSE) © BPMN Kit — made by [u11g](https://u11g.com)

<div align="center">
  <a href="https://bpmnkit.com"><img src="https://bpmnkit.com/favicon.svg" width="32" height="32" alt="BPMN Kit"></a>
</div>
