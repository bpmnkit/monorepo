<div align="center">
  <a href="https://bpmnkit.com"><img src="https://bpmnkit.com/favicon.svg" width="72" height="72" alt="BPMN Kit logo"></a>
  <h1>@bpmnkit/core</h1>
  <p>TypeScript-first BPMN 2.0 SDK — parse, build, layout, and optimize diagrams</p>

  [![npm](https://img.shields.io/npm/v/@bpmnkit/core?style=flat-square&color=6244d7)](https://www.npmjs.com/package/@bpmnkit/core)
  [![license](https://img.shields.io/npm/l/@bpmnkit/core?style=flat-square)](https://github.com/bpmnkit/monorepo/blob/main/LICENSE)
  [![typescript](https://img.shields.io/badge/TypeScript-strict-6244d7?style=flat-square&logo=typescript&logoColor=white)](https://github.com/bpmnkit/monorepo)

  [Website](https://bpmnkit.com) · [Documentation](https://docs.bpmnkit.com) · [GitHub](https://github.com/bpmnkit/monorepo) · [Changelog](https://github.com/bpmnkit/monorepo/blob/main/packages/core/CHANGELOG.md)
</div>

---

## Overview

`@bpmnkit/core` is the foundation of the BPMN Kit. It gives you everything to work with BPMN 2.0, DMN 1.3, and Camunda Form definitions in pure TypeScript — no XML wrestling, no runtime dependencies.

```
Parse → Modify → Validate → Export
```

## Features

- **BPMN 2.0** — parse, create, and export process diagrams with full Zeebe/Camunda 8 extension support
- **Fluent Builder API** — construct valid processes programmatically, never touch raw XML
- **Sugiyama Layout Engine** — auto-position elements with clean orthogonal edge routing
- **DMN 1.3** — decision tables, including FEEL expression support
- **Camunda Form Definitions** — type-safe form schema builder
- **Optimizer** — built-in rule engine to detect and auto-fix anti-patterns
- **Compact Format** — 70% smaller token-efficient JSON representation for AI/LLM workflows
- **Zero Dependencies** — runs in browsers, Node.js, Deno, Bun, and edge runtimes

## Installation

```sh
npm install @bpmnkit/core
pnpm add @bpmnkit/core
```

## Quick Start

### Build a process from code

```typescript
import { Bpmn } from "@bpmnkit/core"

const process = Bpmn.createProcess("order-flow", "Order Flow")
  .startEvent("start", "Order Received")
  .serviceTask("validate", "Validate Order", {
    type: "order-validator",
    inputs: [{ source: "=order", target: "order" }],
    outputs: [{ source: "=valid", target: "isValid" }],
  })
  .exclusiveGateway("check", "Order Valid?")
  .sequenceFlow("check", "fulfill", "=isValid = true")
  .serviceTask("fulfill", "Fulfill Order", { type: "fulfillment-service" })
  .endEvent("end", "Order Complete")
  .sequenceFlow("check", "reject", "=isValid = false")
  .endEvent("reject-end", "Order Rejected")
  .build()

const xml = Bpmn.export(process)
```

### Parse and modify existing BPMN

```typescript
import { Bpmn } from "@bpmnkit/core"

const defs = Bpmn.parse(xml)
const process = defs.processes[0]

// Access flow elements
for (const el of process.flowElements) {
  console.log(el.type, el.id, el.name)
}

// Serialize back to XML
const updated = Bpmn.export(defs)
```

### Auto-layout a process

```typescript
import { Bpmn, layoutProcess } from "@bpmnkit/core"

const defs = Bpmn.parse(xml)
const result = layoutProcess(defs.processes[0])
// result.defs now has updated DI coordinates
const laid = Bpmn.export(result.defs)
```

### Optimize a diagram

```typescript
import { Bpmn, optimize } from "@bpmnkit/core"

const defs = Bpmn.parse(xml)
const report = optimize(defs)

console.log(`${report.summary.total} findings`)

for (const finding of report.findings) {
  console.log(`[${finding.severity}] ${finding.message}`)
  if (finding.applyFix) {
    const { description } = finding.applyFix(defs)
    console.log("Fixed:", description)
  }
}
```

### Compact format for AI/LLM workflows

```typescript
import { Bpmn, compactify, expand } from "@bpmnkit/core"

// Shrink for AI prompt
const defs = Bpmn.parse(xml)
const compact = compactify(defs)          // ~70% smaller JSON
const json = JSON.stringify(compact)      // send to LLM

// Restore full BPMN from AI response
const restored = expand(JSON.parse(json))
const outXml = Bpmn.export(restored)
```

## API Reference

### BPMN

| Export | Description |
|--------|-------------|
| `Bpmn.parse(xml)` | Parse BPMN XML → `BpmnDefinitions` |
| `Bpmn.export(defs)` | Serialize `BpmnDefinitions` → XML |
| `Bpmn.createProcess(id, name?)` | Start a `ProcessBuilder` |
| `Bpmn.makeEmpty(processId?, name?)` | Minimal BPMN XML with one start event |
| `Bpmn.SAMPLE_XML` | 3-node sample diagram string |

### DMN

| Export | Description |
|--------|-------------|
| `Dmn.parse(xml)` | Parse DMN XML → `DmnDefinitions` |
| `Dmn.export(defs)` | Serialize → XML |
| `Dmn.createDecisionTable(id, name?)` | Start a `DecisionTableBuilder` |
| `Dmn.makeEmpty()` | Minimal DMN with one empty decision table |

### Form

| Export | Description |
|--------|-------------|
| `Form.create()` | Start a `FormBuilder` |
| `Form.parse(json)` | Parse a form schema |
| `Form.export(schema)` | Serialize → JSON string |

### Layout & Optimization

| Export | Description |
|--------|-------------|
| `layoutProcess(process)` | Auto-layout all elements; returns `LayoutResult` |
| `optimize(defs)` | Run all optimization rules; returns `OptimizeReport` |
| `compactify(defs)` | Convert to compact `CompactDiagram` |
| `expand(compact)` | Restore full `BpmnDefinitions` |
| `generateId(prefix)` | Generate a unique short ID |

---

## Related Packages

| Package | Description |
|---------|-------------|
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
| [`@bpmnkit/casen-worker-http`](https://www.npmjs.com/package/@bpmnkit/casen-worker-http) | Example HTTP worker plugin — completes jobs with live JSONPlaceholder API data |
| [`@bpmnkit/casen-worker-ai`](https://www.npmjs.com/package/@bpmnkit/casen-worker-ai) | AI task worker — classify, summarize, extract, and decide using Claude |

## License

[MIT](https://github.com/bpmnkit/monorepo/blob/main/LICENSE) © BPMN Kit — made by [u11g](https://u11g.com)

<div align="center">
  <a href="https://bpmnkit.com"><img src="https://bpmnkit.com/favicon.svg" width="32" height="32" alt="BPMN Kit"></a>
</div>
