<div align="center">
  <img src="https://raw.githubusercontent.com/bpmnkit/monorepo/main/doc/logos/2026.svg" width="72" height="72" alt="BPMN Kit logo">
  <h1>@bpmnkit/engine</h1>
  <p>Lightweight BPMN 2.0 process execution engine for browsers and Node.js — zero dependencies</p>

  [![npm](https://img.shields.io/npm/v/@bpmnkit/engine?style=flat-square&color=6244d7)](https://www.npmjs.com/package/@bpmnkit/engine)
  [![license](https://img.shields.io/npm/l/@bpmnkit/engine?style=flat-square)](https://github.com/bpmnkit/monorepo/blob/main/LICENSE)
  [![typescript](https://img.shields.io/badge/TypeScript-strict-6244d7?style=flat-square&logo=typescript&logoColor=white)](https://github.com/bpmnkit/monorepo)

  [Website](https://bpmnkit.com) · [Documentation](https://docs.bpmnkit.com) · [GitHub](https://github.com/bpmnkit/monorepo) · [Changelog](https://github.com/bpmnkit/monorepo/blob/main/packages/engine/CHANGELOG.md)
</div>

---

## Overview

`@bpmnkit/engine` simulates BPMN 2.0 process execution. Deploy a diagram, start instances, track active elements, evaluate DMN decisions, and step through execution — all without a Camunda cluster.

Perfect for: workflow testing, visual debugging, interactive demos, offline simulation, and process-driven UI flows.

## Features

- **Full control flow** — exclusive, parallel, inclusive, event-based, complex gateways
- **Variable scopes** — hierarchical scope chain; FEEL expression evaluation for conditions/mappings
- **All event types** — message, signal, timer (ISO 8601 duration/date/cycle), error, escalation, compensation
- **Boundary events** — interrupting and non-interrupting error, timer, compensation
- **Sub-processes** — embedded, call activity (process invocation by ID)
- **DMN decisions** — inline decision table evaluation via `@bpmnkit/feel`
- **Job workers** — register handlers for service tasks by job type
- **Step-by-step** — `beforeComplete` hook pauses between elements for debugging UIs
- **Zero dependencies** — browser + Node.js, no server required

## Installation

```sh
npm install @bpmnkit/engine
```

## Quick Start

```typescript
import { Engine } from "@bpmnkit/engine"

const engine = new Engine()

// Deploy a BPMN process
engine.deploy({ bpmn: xml })

// Register job workers
engine.registerJobWorker("payment-service", async (job) => {
  const result = await processPayment(job.variables)
  return { success: result.ok }
})

// Start an instance
const instance = engine.start("order-process", {
  orderId: "ORD-001",
  amount: 99.99,
})

// Track execution
instance.onChange((state) => {
  console.log("Active:", state.activeElements)
  console.log("Vars:", state.variables_snapshot)
})
```

## Step-by-step execution

```typescript
const steps: Array<() => void> = []

const instance = engine.start("my-process", {}, {
  beforeComplete: (elementId) =>
    new Promise((resolve) => {
      console.log("Paused at:", elementId)
      steps.push(resolve)  // advance by calling steps.pop()()
    }),
})
```

## API Reference

### `Engine`

| Method | Description |
|--------|-------------|
| `deploy({ bpmn, forms?, decisions? })` | Register BPMN (+ optional DMN/form assets) |
| `start(processId, variables?, options?)` | Start a new instance; returns `ProcessInstance` |
| `registerJobWorker(type, handler)` | Handle service tasks with a given job type |
| `getDeployedProcesses()` | List all deployed process IDs |

### `ProcessInstance`

| Member | Description |
|--------|-------------|
| `state` | `"running" \| "completed" \| "terminated" \| "failed"` |
| `activeElements` | IDs of currently active flow nodes |
| `variables_snapshot` | Flat snapshot of current variable scope |
| `onChange(cb)` | Subscribe to state changes |
| `cancel()` | Terminate the instance |
| `deliverMessage(name, variables?)` | Correlate a message catch event |
| `beforeComplete?` | Optional step hook (set after `start()`) |

---

## Related Packages

| Package | Description |
|---------|-------------|
| [`@bpmnkit/core`](https://www.npmjs.com/package/@bpmnkit/core) | BPMN/DMN/Form parser, builder, layout engine |
| [`@bpmnkit/canvas`](https://www.npmjs.com/package/@bpmnkit/canvas) | Zero-dependency SVG BPMN viewer |
| [`@bpmnkit/editor`](https://www.npmjs.com/package/@bpmnkit/editor) | Full-featured interactive BPMN editor |
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

## License

[MIT](https://github.com/bpmnkit/monorepo/blob/main/LICENSE) © BPMN Kit — made by [u11g](https://u11g.com)
