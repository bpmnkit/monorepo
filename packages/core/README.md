<div align="center">
  <a href="https://bpmnkit.com"><img src="https://bpmnkit.com/favicon.svg" width="72" height="72" alt="BPMN Kit logo"></a>
  <h1>@bpmnkit/core</h1>
  <p>TypeScript-first BPMN 2.0 SDK — parse, build, layout, and optimize diagrams</p>

  [![npm](https://img.shields.io/npm/v/@bpmnkit/core?style=flat-square&color=6244d7)](https://www.npmjs.com/package/@bpmnkit/core)
  [![license](https://img.shields.io/npm/l/@bpmnkit/core?style=flat-square)](https://github.com/bpmnkit/monorepo/blob/main/LICENSE)
  [![typescript](https://img.shields.io/badge/TypeScript-strict-6244d7?style=flat-square&logo=typescript&logoColor=white)](https://github.com/bpmnkit/monorepo)
  [![ai-assisted](https://img.shields.io/badge/AI--assisted-claude-8b5cf6?style=flat-square)](https://github.com/bpmnkit/monorepo)
  [![tier: core](https://img.shields.io/badge/tier-core-16a34a?style=flat-square)](https://bpmnkit.com/docs/getting-started/stability#product-tiers)

  [Website](https://bpmnkit.com) · [Documentation](https://bpmnkit.com/docs) · [GitHub](https://github.com/bpmnkit/monorepo) · [Changelog](https://github.com/bpmnkit/monorepo/blob/main/packages/core/CHANGELOG.md)
</div>

> **Core tier.** Semver at 1.0: nothing breaks without a major release. See [product tiers](https://bpmnkit.com/docs/getting-started/stability#product-tiers).

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

Every element takes `(id, options)`. Branches off a gateway are declared with
`.branch()`, not by wiring flows by hand — the builder creates the sequence flows.

```typescript
import { Bpmn } from "@bpmnkit/core"

const defs = Bpmn.createProcess("order-flow")
  .name("Order Flow")
  .startEvent("start", { name: "Order Received" })
  .serviceTask("validate", {
    name: "Validate Order",
    taskType: "order-validator",
    ioMapping: {
      inputs: [{ source: "=order", target: "order" }],
      outputs: [{ source: "=valid", target: "isValid" }],
    },
  })
  .exclusiveGateway("check", { name: "Order Valid?" })
  .branch("valid", (b) =>
    b
      .condition("=isValid = true")
      .serviceTask("fulfill", { name: "Fulfill Order", taskType: "fulfillment-service" })
      .endEvent("end", { name: "Order Complete" }),
  )
  .branch("invalid", (b) =>
    b.defaultFlow().endEvent("reject-end", { name: "Order Rejected" }),
  )
  .withAutoLayout()
  .build()

const xml = Bpmn.export(defs)
```

### Sub-processes, boundary events and multi-instance

These are the constructs most often reached for and most often guessed at, so the
exact shapes are worth stating. `subProcess` takes its body as a **callback**
(second argument) and options third. A boundary event needs the id of the activity
it attaches to; `withBoundary` supplies it from the preceding activity for you.

```typescript
import { Bpmn } from "@bpmnkit/core"

const defs = Bpmn.createProcess("fulfilment")
  .name("Fulfilment")
  .startEvent("start")

  // Sub-process: id, content callback, then options.
  // multiInstance runs the body once per item in the collection.
  .subProcess(
    "provision",
    (sub) => {
      sub
        .startEvent("p-start")
        .serviceTask("provision-line", { name: "Provision Line", taskType: "provision" })
        .endEvent("p-end")
    },
    {
      name: "Provision Each Line",
      multiInstance: { collection: "=order.lines", elementVariable: "line", isSequential: false },
    },
  )

  // withBoundary attaches to the activity just added — no id repeated.
  .serviceTask("charge", { name: "Charge Payment", taskType: "payment" })
  .withBoundary("charge-failed", { errorCode: "PAYMENT_FAILED" }, (b) => {
    b.serviceTask("retry-charge", { name: "Retry Charge", taskType: "payment" }).endEvent("gave-up")
  })

  // Wait for whichever event arrives first.
  .eventBasedGateway("await-payment", { name: "Paid?" })
  .branch("paid", (b) =>
    b
      .intermediateCatchEvent("payment-confirmed", {
        messageName: "PaymentConfirmed",
        correlationKey: "=orderId",
      })
      .endEvent("done"),
  )
  .branch("timeout", (b) =>
    b.intermediateCatchEvent("payment-timeout", { timerDuration: "P14D" }).endEvent("written-off"),
  )
  .withAutoLayout()
  .build()
```

Attach a boundary event explicitly when it is not the preceding activity — both
forms below are accepted, and a boundary event with no host throws rather than
exporting BPMN that cannot be read back:

```typescript
.boundaryEvent("timeout", { attachedTo: "charge", timerDuration: "PT30M" })
.boundaryEvent("timeout", "charge", { timerDuration: "PT30M" })
```

Event definitions are named options, not nested objects — `timerDuration`,
`timerDate`, `timerCycle`, `messageName` (with `correlationKey`),
`errorCode`, `signalName`, `compensation`. An option the builder does not
know is dropped silently, so `timer: { duration: "P7D" }` produces a boundary
event with no timer on it.

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
import { applyAutoLayout, Bpmn } from "@bpmnkit/core"

// Lays out every process and writes the diagram interchange back onto the model.
const laid = Bpmn.export(applyAutoLayout(Bpmn.parse(xml)))
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

### Rendering while the model is still writing

A model emits a diagram one token at a time, and the outermost `}` — the one
`JSON.parse` waits for — is the last character it sends. `createCompactStream`
reads the elements out of the text as their own literals close, so there is
something to draw long before the document is finished:

```typescript
import { createCompactStream } from "@bpmnkit/core"

// `base` is the diagram being edited, so a frame shows the whole thing rather
// than the fragment the model is adding to it. Omit it to build from nothing.
const diagramStream = createCompactStream({ base: null })

function onModelChunk(chunk: string): void {
  const frame = diagramStream.push(chunk) // null until the frame changes
  if (frame) console.log("elements so far:", frame.processes[0]?.flowElements.length)
}
```

Frames are a guess at an unfinished document: `push` never throws, drops what it
cannot place, and expects the caller to have an authoritative result coming.

## API Reference

### BPMN

| Export | Description |
|--------|-------------|
| `Bpmn.parse(xml)` | Parse BPMN XML → `BpmnDefinitions` |
| `Bpmn.export(defs)` | Serialize `BpmnDefinitions` → XML |
| `Bpmn.createProcess(id)` | Start a `ProcessBuilder`; set the name with `.name(…)` |
| `Bpmn.makeEmpty(processId?, name?)` | Minimal BPMN XML with one start event |
| `Bpmn.SAMPLE_XML` | 3-node sample diagram string |

### Process builder

Every element method is `(id, options)` and returns the builder. The same methods
exist inside `.branch()` and inside a sub-process body.

| Method | Description |
|--------|-------------|
| `.name(name)` / `.versionTag(v)` | Process-level metadata |
| `.startEvent(id?, options?)` / `.endEvent(id?, options?)` | Events; `options.name` labels them |
| `.serviceTask(id, { taskType, ioMapping?, taskHeaders? })` | Zeebe job worker task |
| `.userTask(id, opts)` / `.businessRuleTask(id, { decisionRef })` / `.scriptTask(id, opts)` | Other task types |
| `.receiveTask(id, { message })` / `.sendTask(id, opts)` / `.callActivity(id, opts)` | Message and call activities |
| `.restConnector(id, { method, url, … })` | Camunda 8 HTTP connector task |
| `.exclusiveGateway(id, opts)` / `.parallelGateway` / `.inclusiveGateway` / `.eventBasedGateway` | Gateways |
| `.branch(name, b => …)` | One path off the preceding gateway |
| `b.condition(feel)` / `b.defaultFlow()` | Mark a branch's condition, or make it the default |
| `.connectTo(id)` | Flow to an existing or later element — merges and loops |
| `.subProcess(id, content, options?)` | Embedded sub-process; `content` is a callback |
| `.transaction(id, content, options?)` / `.eventSubProcess` / `.adHocSubProcess` | Other containers |
| `.withBoundary(id, options, handler)` | Boundary event on the preceding activity, plus its path |
| `.boundaryEvent(id, options)` | Boundary event naming its host in `options.attachedTo` |
| `.intermediateCatchEvent(id, opts)` / `.intermediateThrowEvent(id, opts)` | Intermediate events |
| `.withAutoLayout()` | Compute coordinates on `build()` — no x/y by hand |
| `.build()` | Produce `BpmnDefinitions`; pass to `Bpmn.export` |

Event definitions are options on the element: `timerDuration`, `timerDate`,
`timerCycle`, `messageName` + `correlationKey`, `errorCode`, `signalName`,
`compensation`. Multi-instance is `options.multiInstance =
{ collection, elementVariable, isSequential? }`.

### Semantics

| Export | Description |
|--------|-------------|
| `semanticHash(defs)` | SHA-256 of the model, excluding the diagram. Unchanged by layout |
| `projectSemantics(defs)` | The canonical, presentation-free projection the hash covers |
| `diffSemantics(a, b)` | What changed between two models, keyed by element id |

### Typed code generation

| Export | Description |
|--------|-------------|
| `generateProcessTypes(defs \| defs[], options?)` | TypeScript source typing job types (variables, output, headers, errors), process ids, messages, signals, error and escalation codes. Deterministic |
| `extractProcessContract(defs \| defs[])` | The same contract as data — what `casen gen types` renders and `--check-workers` compares |

### Editing

| Export | Description |
|--------|-------------|
| `applyBpmnOperations(defs, ops)` | Apply edit operations to the full model. Strict: unresolved ids throw |
| `reconcileCompact(defs, compact)` | Apply a compact diagram as changes, keeping what compact cannot carry |
| `compactify(defs)` | Read-only token-efficient view for LLM prompts. Lossy — not an edit path |

### Writing files (`@bpmnkit/core/node`)

| Export | Description |
|--------|-------------|
| `writeBpmn(defs, opts)` | Serialize, read back, verify the model survived, then write atomically |

```typescript
import { writeBpmn } from "@bpmnkit/core/node"

// Refuses rather than overwrite; pass force: true to replace.
const { semanticHash, changes } = await writeBpmn(defs, { output: "flow.bpmn" })
```

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
| `createCompactStream(opts?)` | Read a diagram out of a model's token stream, frame by frame |
| `generateId(prefix)` | Generate a unique short ID |

---

## Related Packages

| Package | Description |
|---------|-------------|
| [`@bpmnkit/canvas`](https://www.npmjs.com/package/@bpmnkit/canvas) | Zero-dependency SVG BPMN viewer |
| [`@bpmnkit/editor`](https://www.npmjs.com/package/@bpmnkit/editor) | Full-featured interactive BPMN editor |
| [`@bpmnkit/engine`](https://www.npmjs.com/package/@bpmnkit/engine) | Lightweight BPMN process simulator for tests and demos |
| [`@bpmnkit/feel`](https://www.npmjs.com/package/@bpmnkit/feel) | FEEL expression language parser & evaluator |
| [`@bpmnkit/plugins`](https://www.npmjs.com/package/@bpmnkit/plugins) | 34 composable canvas plugins |
| [`@bpmnkit/api`](https://www.npmjs.com/package/@bpmnkit/api) | Camunda 8 REST API TypeScript client |
| [`@bpmnkit/ascii`](https://www.npmjs.com/package/@bpmnkit/ascii) | Render BPMN diagrams as Unicode ASCII art |
| [`@bpmnkit/markdown`](https://www.npmjs.com/package/@bpmnkit/markdown) | BPMN diagrams in Markdown — remark, markdown-it and README pre-rendering |
| [`@bpmnkit/docspack`](https://www.npmjs.com/package/@bpmnkit/docspack) | BPMN Kit docs as an offline docspack package for AI agents |
| [`@bpmnkit/camunda-docspack`](https://www.npmjs.com/package/@bpmnkit/camunda-docspack) | Camunda 8 docs as an offline docspack package for AI agents |
| [`@bpmnkit/ui`](https://www.npmjs.com/package/@bpmnkit/ui) | Shared design tokens and UI components |
| [`@bpmnkit/profiles`](https://www.npmjs.com/package/@bpmnkit/profiles) | Shared auth, profile storage, and client factories for CLI & proxy |
| [`@bpmnkit/operate`](https://www.npmjs.com/package/@bpmnkit/operate) | Monitoring & operations frontend for Camunda clusters |
| [`@bpmnkit/connector-gen`](https://www.npmjs.com/package/@bpmnkit/connector-gen) | Generate connector templates from OpenAPI specs |
| [`@bpmnkit/connectors`](https://www.npmjs.com/package/@bpmnkit/connectors) | Camunda 8 OOTB connector catalog and deterministic template application |
| [`@bpmnkit/cli`](https://www.npmjs.com/package/@bpmnkit/cli) | Camunda 8 command-line interface (casen) |
| [`@bpmnkit/proxy`](https://www.npmjs.com/package/@bpmnkit/proxy) | Local AI bridge and Camunda API proxy server |
| [`@bpmnkit/patterns`](https://www.npmjs.com/package/@bpmnkit/patterns) | Domain process patterns for BPMNKit AIKit |
| [`@bpmnkit/reebe-wasm`](https://www.npmjs.com/package/@bpmnkit/reebe-wasm) | WebAssembly BPMN engine for browser simulation |
| [`@bpmnkit/worker-client`](https://www.npmjs.com/package/@bpmnkit/worker-client) | Thin Zeebe REST client for standalone workers |
| [`@bpmnkit/user-tasks`](https://www.npmjs.com/package/@bpmnkit/user-tasks) | Embeddable user task widget for Camunda 8 |
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
