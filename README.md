# @bpmnkit/core

[![npm version](https://img.shields.io/npm/v/@bpmnkit/core)](https://www.npmjs.com/package/@bpmnkit/core)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-blue)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)

A TypeScript SDK for working with Camunda 8 process automation artifacts — BPMN, DMN, and Forms. Parse, build, and export process definitions programmatically with full type safety and roundtrip fidelity.

## Table of Contents

- [Why this SDK?](#why-this-sdk)
- [Features](#features)
- [Installation](#installation)
- [Quick Start](#quick-start)
- [Advanced Examples](#advanced-examples)
- [API Reference](#api-reference)
- [Best Practices](#best-practices)
- [Development](#development)
- [Contributing](#contributing)
- [License](#license)

## Why this SDK?

- **Type-safe models** — Discriminated unions, strict TypeScript, and full IntelliSense support
- **Roundtrip fidelity** — Parse → export preserves semantic equivalence, extensions, and diagram interchange
- **Fluent builders** — Method-chaining APIs that guide you through valid process construction
- **Minimal footprint** — Single runtime dependency (`fast-xml-parser`), ESM-only, tree-shakeable
- **Production-tested** — Roundtrip-validated against 34 real-world process files

## Features

| Module | Parse | Build | Export | Format |
|--------|:-----:|:-----:|:------:|--------|
| **BPMN** | ✅ | ✅ | ✅ | XML |
| **DMN** | ✅ | ✅ | ✅ | XML |
| **Forms** | ✅ | ✅ | ✅ | JSON |

- **Auto-layout** — Sugiyama/layered layout algorithm with sub-process support
- **Extension preservation** — Zeebe, modeler, and Camunda extensions roundtrip correctly
- **Diagram interchange** — BPMNDI shapes and edges preserved on roundtrip

## Requirements

- **Node.js** ≥ 18 (latest LTS recommended)
- **TypeScript** ≥ 5.0 (for type-safe usage)

## Installation

```bash
npm install @bpmnkit/core
```

```bash
pnpm add @bpmnkit/core
```

```bash
yarn add @bpmnkit/core
```

## Quick Start

### BPMN — Build a Process

```typescript
import { Bpmn } from "@bpmnkit/core";

const definitions = Bpmn.createProcess("order-process")
  .name("Order Process")
  .startEvent("start")
  .serviceTask("validate", {
    name: "Validate Order",
    taskType: "validate-order",
  })
  .exclusiveGateway("check", { name: "Order Valid?" })
    .branch("yes", (b) =>
      b.condition("= valid")
        .serviceTask("fulfill", { name: "Fulfill", taskType: "fulfill-order" })
        .endEvent("end-ok")
    )
    .branch("no", (b) =>
      b.defaultFlow()
        .serviceTask("notify", { name: "Notify Customer", taskType: "send-rejection" })
        .endEvent("end-rejected")
    )
  .build();

const xml = Bpmn.export(definitions);
```

### BPMN — Parse and Inspect

```typescript
import { Bpmn } from "@bpmnkit/core";

const definitions = Bpmn.parse(xml);
const process = definitions.processes[0];

for (const element of process.flowElements) {
  switch (element.type) {
    case "serviceTask":
      console.log(`Service: ${element.id} — ${element.name}`);
      break;
    case "exclusiveGateway":
      console.log(`Gateway: ${element.name}`);
      break;
  }
}
```

### DMN

```typescript
import { Dmn } from "@bpmnkit/core";

// Build a decision table
const definitions = Dmn.createDecisionTable("risk-level")
  .name("Risk Level")
  .hitPolicy("FIRST")
  .input({ label: "Age", expression: "age", typeRef: "integer" })
  .output({ label: "Risk", name: "risk", typeRef: "string" })
  .rule({ inputs: ["< 25"], outputs: ['"high"'], description: "Young driver" })
  .rule({ inputs: [">= 25"], outputs: ['"low"'], description: "Standard" })
  .build();

const xml = Dmn.export(definitions);

// Parse existing DMN
const parsed = Dmn.parse(xml);
console.log(`${parsed.decisions[0].decisionTable.rules.length} rules`);
```

### Forms

```typescript
import { Form } from "@bpmnkit/core";

const form = Form.create("onboarding")
  .textField({ key: "name", label: "Full Name" })
  .select({
    key: "department",
    label: "Department",
    values: [
      { label: "Engineering", value: "eng" },
      { label: "Sales", value: "sales" },
    ],
  })
  .checkbox({ key: "agree", label: "I agree to the terms" })
  .build();

const json = Form.export(form);
```

## Advanced Examples

### REST Connector

Build HTTP connector service tasks with a dedicated convenience API:

```typescript
import { Bpmn } from "@bpmnkit/core";

const definitions = Bpmn.createProcess("api-call")
  .startEvent("start")
  .restConnector("fetch-users", {
    method: "GET",
    url: "https://api.example.com/users",
    authentication: { type: "bearer", token: "=secrets.API_TOKEN" },
    resultVariable: "response",
    resultExpression: "= response.body.users",
  })
  .endEvent("end")
  .build();
```

### Parallel Branches

```typescript
const definitions = Bpmn.createProcess("parallel-flow")
  .startEvent("start")
  .parallelGateway("fork")
    .branch("a", (b) =>
      b.serviceTask("task-a", { name: "Task A", taskType: "worker-a" })
    )
    .branch("b", (b) =>
      b.serviceTask("task-b", { name: "Task B", taskType: "worker-b" })
    )
  .parallelGateway("join")
  .endEvent("end")
  .build();
```

### Boundary Events

```typescript
const definitions = Bpmn.createProcess("with-timeout")
  .startEvent("start")
  .serviceTask("long-task", {
    name: "Long Running Task",
    taskType: "long-worker",
  })
  .boundaryEvent("timeout", {
    attachedTo: "long-task",
    timerDuration: "PT30S",
  })
  .endEvent("timeout-end")
  .build();
```

### Sub-Processes

```typescript
const definitions = Bpmn.createProcess("with-subprocess")
  .startEvent("start")
  .subProcess("inner", { name: "Inner Process" }, (sub) => {
    sub
      .startEvent("sub-start")
      .serviceTask("sub-task", { name: "Sub Task", taskType: "sub-worker" })
      .endEvent("sub-end");
  })
  .endEvent("end")
  .build();
```

### Auto-Layout

Builder-created workflows have no visual layout by default. Call `.withAutoLayout()` to automatically generate diagram interchange data (shapes with bounds and edges with waypoints) using a Sugiyama/layered layout algorithm:

```typescript
const definitions = Bpmn.createProcess("order-process")
  .withAutoLayout()
  .startEvent("start")
  .serviceTask("validate", {
    name: "Validate Order",
    taskType: "validate-order",
  })
  .exclusiveGateway("check", { name: "Order Valid?" })
    .branch("yes", (b) =>
      b.condition("= valid")
        .serviceTask("fulfill", { name: "Fulfill", taskType: "fulfill-order" })
        .endEvent("end-ok")
    )
    .branch("no", (b) =>
      b.defaultFlow()
        .serviceTask("notify", { name: "Notify Customer", taskType: "send-rejection" })
        .endEvent("end-rejected")
    )
  .build();

const xml = Bpmn.export(definitions);
// XML now includes <bpmndi:BPMNDiagram> with shapes and edges
```

The layout engine handles:
- **Left-to-right flow** — elements are positioned with increasing x coordinates
- **Gateway branches** — parallel paths are spaced vertically without overlaps
- **Sub-processes** — children are positioned within parent bounds
- **Element sizing** — events (36×36), tasks (100×80), gateways (50×50)
- **Orthogonal edge routing** — sequence flow waypoints use right-angle paths

Without `.withAutoLayout()`, the exported XML contains valid BPMN semantics but the `<bpmndi:BPMNDiagram>` section is omitted entirely. Most BPMN viewers require diagram interchange data to render processes visually.

### Roundtrip — Parse, Modify, Export

```typescript
import { Bpmn } from "@bpmnkit/core";
import type { BpmnDefinitions } from "@bpmnkit/core";

// Parse existing BPMN XML
const definitions: BpmnDefinitions = Bpmn.parse(existingXml);

// Inspect the model
const process = definitions.processes[0];
console.log(`Process: ${process.id}, ${process.flowElements.length} elements`);

// Export back to XML (preserves extensions, DI, namespaces)
const xml = Bpmn.export(definitions);
```

### TypeScript Type Narrowing

The SDK exports all model types for fully typed workflows:

```typescript
import type {
  BpmnDefinitions,
  BpmnServiceTask,
  BpmnFlowElement,
} from "@bpmnkit/core";

// Use discriminated unions to narrow element types
function getServiceTasks(definitions: BpmnDefinitions): BpmnServiceTask[] {
  return definitions.processes
    .flatMap((p) => p.flowElements)
    .filter((el): el is BpmnServiceTask => el.type === "serviceTask");
}
```

## API Reference

### `Bpmn`

| Method | Returns | Description |
|--------|---------|-------------|
| `Bpmn.createProcess(id)` | `ProcessBuilder` | Create a new process using the fluent builder API |
| `Bpmn.parse(xml)` | `BpmnDefinitions` | Parse BPMN XML string into a typed model |
| `Bpmn.export(definitions)` | `string` | Serialize a `BpmnDefinitions` model to BPMN XML |

**Builder methods:**

| Category | Methods |
|----------|---------|
| **Events** | `startEvent()`, `endEvent()`, `intermediateThrowEvent()`, `intermediateCatchEvent()`, `boundaryEvent()` |
| **Tasks** | `serviceTask()`, `userTask()`, `scriptTask()`, `sendTask()`, `receiveTask()`, `businessRuleTask()`, `callActivity()` |
| **Gateways** | `exclusiveGateway()`, `parallelGateway()`, `inclusiveGateway()`, `eventBasedGateway()` — each with `branch(name, callback)` |
| **Sub-processes** | `subProcess()`, `adHocSubProcess()`, `eventSubProcess()` — with nested `SubProcessContentBuilder` |
| **Flow control** | `connectTo(id)` for merging and loops, `element(id)` for navigation |
| **Connectors** | `restConnector(id, config)` for Camunda HTTP JSON connector tasks |
| **Layout** | `withAutoLayout()` — generates diagram interchange (shapes + edges) via Sugiyama layout engine |
| **Extensions** | Multi-instance (parallel/sequential), Zeebe task definitions, IO mappings, task headers, modeler templates |

### `Dmn`

| Method | Returns | Description |
|--------|---------|-------------|
| `Dmn.createDecisionTable(id)` | `DecisionTableBuilder` | Create a new decision table |
| `Dmn.parse(xml)` | `DmnDefinitions` | Parse DMN XML into a typed model |
| `Dmn.export(definitions)` | `string` | Serialize a `DmnDefinitions` model to DMN XML |

**Supported hit policies:** `UNIQUE` (default), `FIRST`, `ANY`, `COLLECT`, `RULE ORDER`, `OUTPUT ORDER`, `PRIORITY`

### `Form`

| Method | Returns | Description |
|--------|---------|-------------|
| `Form.create(id?)` | `FormBuilder` | Create a new form using the fluent builder |
| `Form.parse(json)` | `FormDefinition` | Parse Camunda Form JSON into a typed model |
| `Form.export(form)` | `string` | Serialize a `FormDefinition` model to JSON |

**Component types:** `text`, `textfield`, `textarea`, `select`, `radio`, `checkbox`, `checklist`, `group` (with nesting)

## Best Practices

### Use Descriptive IDs

Element IDs appear in logs, metrics, and error messages. Use meaningful, kebab-case identifiers:

```typescript
// ✅ Good — IDs describe what the element does
Bpmn.createProcess("order-fulfillment")
  .serviceTask("validate-payment", { ... })
  .serviceTask("ship-order", { ... })

// ❌ Avoid — auto-generated or meaningless IDs
Bpmn.createProcess("Process_1")
  .serviceTask("Activity_0x1a2b", { ... })
```

### Leverage Discriminated Unions

The parsed model uses discriminated unions on the `type` field. Use `switch` or type guards for safe property access:

```typescript
for (const el of process.flowElements) {
  if (el.type === "serviceTask") {
    // TypeScript narrows `el` to BpmnServiceTask
    console.log(el.extensionElements);
  }
}
```

### Prefer `branch()` for Gateway Patterns

The `branch(name, callback)` pattern ensures gateway branches are properly connected with sequence flows:

```typescript
.exclusiveGateway("decision")
  .branch("approved", (b) =>
    b.condition("= status = 'approved'")
      .serviceTask("process", { ... })
  )
  .branch("rejected", (b) =>
    b.defaultFlow()
      .endEvent("end-rejected")
  )
```

### Use Roundtrip for Modifications

When modifying existing BPMN files, parse → modify → export to preserve extensions and diagram data:

```typescript
const definitions = Bpmn.parse(existingXml);
// Modify the model...
const updatedXml = Bpmn.export(definitions);
```

### Keep Processes Composable

Use `callActivity()` to reference sub-processes by ID, keeping each process focused:

```typescript
const definitions = Bpmn.createProcess("main")
  .startEvent("start")
  .callActivity("validate", { processId: "validation-process" })
  .callActivity("fulfill", { processId: "fulfillment-process" })
  .endEvent("end")
  .build();
```

## Project Structure

```
packages/
  bpmn-sdk/          # Main SDK package — @bpmnkit/core
    src/
      bpmn/          # BPMN parser, serializer, builder, model
      dmn/           # DMN parser, serializer, builder, model
      form/          # Form parser, serializer, builder, model
      layout/        # BPMN auto-layout engine (Sugiyama/layered)
      xml/           # Generic XML parser/serializer
      types/         # Shared types (XmlElement, ID generator)
    tests/           # Vitest test suites
apps/
  examples/          # Runnable example workflows (see Examples section)
examples/            # 34 real-world BPMN, DMN, and Form files for roundtrip testing
```

## Examples

The `apps/examples` package contains five runnable example workflows that demonstrate the SDK's core features.

| File | Demonstrates |
|---|---|
| `01-employee-onboarding.ts` | Parallel gateway, business rule task, user tasks, IO mapping |
| `02-incident-response.ts` | Exclusive gateways, sub-process, multiple end events |
| `03-loan-approval.ts` | REST connector, chained gateways, `connectTo()` for merging paths |
| `04-invoice-processing.ts` | Sub-process, inclusive gateway, script task, call activity |
| `05-content-publishing.ts` | Event-based gateway, intermediate events, parallel post-actions |
| `06-ai-code-review-agent.ts` | **Ad-hoc sub-process** as Camunda AI agent, tool tasks, webhook start, confidence routing |

### Running the examples

Build the SDK once, then run any example:

```bash
pnpm install
pnpm build                                    # build @bpmnkit/core first

# Run all five examples (writes BPMN files to apps/examples/output/)
pnpm --filter @bpmnkit/examples all

# Or run a single example
pnpm --filter @bpmnkit/examples 01           # employee onboarding
pnpm --filter @bpmnkit/examples 03           # loan approval
```

Each script writes a `.bpmn` file to `apps/examples/output/`. Open any file in [Camunda Modeler](https://camunda.com/download/modeler/) or paste the XML into [bpmn.io](https://demo.bpmn.io/) to visualise the generated diagram.

## Development

### Prerequisites

- [Node.js](https://nodejs.org/) 18+ (latest LTS recommended)
- [pnpm](https://pnpm.io/) 10+

### Setup

```bash
git clone https://github.com/bpmnkit/monorepo.git
cd monorepo
pnpm install
```

### Commands

| Command | Description |
|---------|-------------|
| `pnpm build` | Build all packages |
| `pnpm test` | Run all tests (Vitest) |
| `pnpm check` | Lint and format check (Biome) |
| `pnpm typecheck` | TypeScript type checking |
| `pnpm verify` | Build + typecheck + check + test |

## Contributing

1. Fork the repository and create a feature branch
2. Install dependencies: `pnpm install`
3. Make your changes and add tests
4. Validate everything passes: `pnpm verify`
5. Add a changeset describing your change: `pnpm changeset`
6. Commit and open a pull request

### Versioning & Releases

This project uses [Changesets](https://github.com/changesets/changesets) for version management and publishing. Every PR that changes package functionality **must** include a changeset.

```bash
pnpm changeset            # Create a new changeset (interactive)
pnpm version-packages     # Apply changesets and bump versions
pnpm release              # Build and publish to npm
```

Changesets enforce semantic versioning:
- **patch** — Bug fixes, internal refactors
- **minor** — New features, new builder methods, new model fields
- **major** — Breaking API changes, model restructuring

### Code Quality

- **Formatter & Linter:** [Biome](https://biomejs.dev/) — run `pnpm check` before submitting
- **Type Safety:** TypeScript strict mode — zero type errors required
- **Tests:** [Vitest](https://vitest.dev/) — all tests must pass

## License

[MIT](./LICENSE)
