<div align="center">
  <img src="https://raw.githubusercontent.com/bpmn-sdk/monorepo/main/doc/logos/logo-2-gateway.svg" width="72" height="72" alt="BPMN SDK logo">
  <h1>@bpmn-sdk/engine</h1>
  <p>Lightweight BPMN 2.0 process execution engine for browsers and Node.js — zero dependencies</p>

  [![npm](https://img.shields.io/npm/v/@bpmn-sdk/engine?style=flat-square&color=6244d7)](https://www.npmjs.com/package/@bpmn-sdk/engine)
  [![license](https://img.shields.io/npm/l/@bpmn-sdk/engine?style=flat-square)](https://github.com/bpmn-sdk/monorepo/blob/main/LICENSE)
  [![typescript](https://img.shields.io/badge/TypeScript-strict-6244d7?style=flat-square&logo=typescript&logoColor=white)](https://github.com/bpmn-sdk/monorepo)

  [Website](https://bpmnsdk.u11g.com) · [Documentation](https://bpmnsdkdocs.u11g.com) · [GitHub](https://github.com/bpmn-sdk/monorepo) · [Changelog](https://github.com/bpmn-sdk/monorepo/blob/main/packages/engine/CHANGELOG.md)
</div>

---

## Overview

`@bpmn-sdk/engine` simulates BPMN 2.0 process execution. Deploy a diagram, start instances, track active elements, evaluate DMN decisions, and step through execution — all without a Camunda cluster.

Perfect for: workflow testing, visual debugging, interactive demos, offline simulation, and process-driven UI flows.

## Features

- **Full control flow** — exclusive, parallel, inclusive, event-based, complex gateways
- **Variable scopes** — hierarchical scope chain; FEEL expression evaluation for conditions/mappings
- **All event types** — message, signal, timer (ISO 8601 duration/date/cycle), error, escalation, compensation
- **Boundary events** — interrupting and non-interrupting error, timer, compensation
- **Sub-processes** — embedded, call activity (process invocation by ID)
- **DMN decisions** — inline decision table evaluation via `@bpmn-sdk/feel`
- **Job workers** — register handlers for service tasks by job type
- **Step-by-step** — `beforeComplete` hook pauses between elements for debugging UIs
- **Zero dependencies** — browser + Node.js, no server required

## Installation

```sh
npm install @bpmn-sdk/engine
```

## Quick Start

```typescript
import { Engine } from "@bpmn-sdk/engine"

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

// Wait for completion
await new Promise((resolve) => {
  instance.onChange((state) => {
    if (state.state === "completed" || state.state === "terminated") resolve(undefined)
  })
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
| [`@bpmn-sdk/core`](https://www.npmjs.com/package/@bpmn-sdk/core) | BPMN/DMN/Form parser, builder, layout engine |
| [`@bpmn-sdk/canvas`](https://www.npmjs.com/package/@bpmn-sdk/canvas) | Zero-dependency SVG BPMN viewer |
| [`@bpmn-sdk/editor`](https://www.npmjs.com/package/@bpmn-sdk/editor) | Full-featured interactive BPMN editor |
| [`@bpmn-sdk/feel`](https://www.npmjs.com/package/@bpmn-sdk/feel) | FEEL expression language parser & evaluator |
| [`@bpmn-sdk/plugins`](https://www.npmjs.com/package/@bpmn-sdk/plugins) | 22 composable canvas plugins |
| [`@bpmn-sdk/api`](https://www.npmjs.com/package/@bpmn-sdk/api) | Camunda 8 REST API TypeScript client |
| [`@bpmn-sdk/ascii`](https://www.npmjs.com/package/@bpmn-sdk/ascii) | Render BPMN diagrams as Unicode ASCII art |

## License

[MIT](https://github.com/bpmn-sdk/monorepo/blob/main/LICENSE) © bpmn-sdk
