---
title: "@bpmnkit/core"
description: Fluent process builder, BPMN 2.0 parser/serializer, auto-layout, and AI-compact format.
sidebar:
  order: 1
---

## Overview

`@bpmnkit/core` is the foundation of BPMN Kit. It provides everything needed to work with
BPMN 2.0 programmatically:

- **Fluent builder** — chain method calls to construct any process shape
- **Parser/serializer** — round-trip BPMN 2.0 XML, keeping unmodelled content verbatim
- **Auto-layout** — Sugiyama algorithm assigns coordinates automatically
- **Compact format** — token-efficient AI-friendly intermediate representation
- **DMN support** — parse, build, and export DMN 1.3 decision tables

Zero runtime dependencies. ESM-only. Runs in browsers, Node.js, Deno, Bun, and edge runtimes.

## Installation

```sh
pnpm add @bpmnkit/core
```

## API Reference

### `Bpmn.createProcess(id, name?)`

Returns a `ProcessBuilder` with the given process ID and optional name.

```typescript
const builder = Bpmn.createProcess("my-process", "My Process");
```

### `Bpmn.createDiagram(id?)`

Returns a `DiagramBuilder` for assembling multiple processes into one BPMN definitions document.
`id` defaults to `"Definitions_1"`.

```typescript
const defs = Bpmn.createDiagram("OrderSystem")
  .process("order-flow", (p) =>
    p.startEvent("s").serviceTask("t", { name: "Process", taskType: "process" }).endEvent("e"),
  )
  .process("payment-flow", (p) =>
    p.startEvent("s2").serviceTask("pay", { name: "Pay", taskType: "pay" }).endEvent("e2"),
  )
  .build();
```

### `Bpmn.export(definitions)`

Serializes a `BpmnDefinitions` object to a BPMN 2.0 XML string.

```typescript
const xml = Bpmn.export(definitions);
```

### `Bpmn.parse(xml)`

Parses a BPMN 2.0 XML string into a typed `BpmnDefinitions` object.

```typescript
const definitions = Bpmn.parse(xmlString);
```

### `Bpmn.makeEmpty(processId?, processName?)`

Returns minimal BPMN 2.0 XML — one process with one start event.

```typescript
const xml = Bpmn.makeEmpty("my-process", "My Process");
// Returns an XML string (not a BpmnDefinitions object)
```

### `Bpmn.SAMPLE_XML`

A constant containing a simple 3-node sample diagram (start → task → end).
Useful for demos and tests.

### `semanticHash(definitions)`

SHA-256 of the model's meaning, with the diagram excluded. Two documents that say the same
thing hash the same however they are laid out, ordered or formatted — so a changed hash means
the model changed, not that the picture moved.

```typescript
import { Bpmn, applyAutoLayout, semanticHash } from "@bpmnkit/core";

const definitions = Bpmn.parse(xml);
semanticHash(applyAutoLayout(definitions)) === semanticHash(definitions); // true
```

Excluded from the hash: diagram interchange and its `bioc`/`color` extensions,
`zeebe:modelerTemplateIcon`, and `exporter`/`exporterVersion`. Element order, attribute order
and whitespace do not affect it. `modeler:executionPlatform` **is** included — it names the
engine the model targets, so changing it is a real change.

Synchronous and dependency-free, so it works in the browser and does not force callers to
become async.

### `projectSemantics(definitions)`

The canonical, presentation-free projection `semanticHash` covers. Returns `{ value, elements }`
— the whole model as canonical JSON, plus a shallow projection per element id.

### `diffSemantics(before, after)`

What changed between two models, as `{ added, removed, changed }` keyed by element id. Changes
are attributed to the element that actually changed rather than to all of its ancestors, and
running auto-layout produces an empty diff.

```typescript
import { diffSemantics } from "@bpmnkit/core";

const { added, removed, changed } = diffSemantics(before, after);
// changed: [{ id: "Task_1", before: {...}, after: {...} }]
```

### `compactify(definitions)`

Projects a `BpmnDefinitions` object onto a `CompactDiagram` — a small JSON object suitable
for LLM prompts. **Lossy:** it keeps topology, names and the common Zeebe bindings, and drops
collaborations, participants, message flows, lanes, data stores, artifacts, root-level
messages and errors, multi-instance loop characteristics, full `zeebe:ioMapping` entries and
diagram interchange.

```typescript
import { compactify } from "@bpmnkit/core";

const compact = compactify(Bpmn.parse(xml));
```

### `expand(compact)`

Builds a `BpmnDefinitions` object from a `CompactDiagram`. It restores only what the compact
form carries, so `expand(compactify(definitions))` is not `definitions` — use this to build a
model from a compact definition, not as a round trip for a file you need to keep.

```typescript
import { expand } from "@bpmnkit/core";

const definitions = expand(compactDiagram);
const xml = Bpmn.export(definitions);
```

### `layoutProcess(process)`

Runs the Sugiyama auto-layout algorithm on a `BpmnProcess` object.
Returns a `LayoutResult` with element positions.

```typescript
import { layoutProcess, ELEMENT_SIZES } from "@bpmnkit/core";

const result = layoutProcess(process);
// result.elements: Map<id, { x, y, width, height }>
// result.flows: Map<id, waypoint[]>
```

### ProcessBuilder methods

All builder methods return `this` for chaining.

| Method | Description |
|---|---|
| `.startEvent(id, options?)` | Add a start event |
| `.endEvent(id, options?)` | Add an end event |
| `.serviceTask(id, options?)` | Add a service task |
| `.userTask(id, options?)` | Add a user task |
| `.scriptTask(id, options?)` | Add a script task |
| `.exclusiveGateway(id, options?)` | Add an XOR gateway |
| `.parallelGateway(id, options?)` | Add a parallel gateway |
| `.inclusiveGateway(id, options?)` | Add an inclusive gateway |
| `.eventBasedGateway(id, options?)` | Add an event-based gateway |
| `.subProcess(id, builder, options?)` | Add an embedded sub-process |
| `.callActivity(id, options?)` | Add a call activity |
| `.intermediateCatchEvent(id, options?)` | Add a catch event |
| `.intermediateThrowEvent(id, options?)` | Add a throw event |
| `.branch(id, builder)` | Define a gateway branch |
| `.boundaryEvent(id, options)` | Attach a boundary event to the previous task |
| `.withBoundary(id, options, handler)` | Attach a boundary event and build its error/timeout path; cursor auto-restores to the main flow after the handler |
| `.defaults(options)` | Set process-wide defaults (e.g. `{ serviceTask: { retries: "5" } }`) applied to all subsequent tasks |
| `.disconnectedStartEvent(id?, options?)` | Add a start event with no auto-connection to the current cursor — alias for `addStartEvent` |
| `.withAutoLayout()` | Apply Sugiyama layout before building |
| `.build(options?)` | Return the completed `BpmnDefinitions`. Pass `{ strict: true }` to throw if auto-join gateways are inserted (encourages explicit topology) |

## DMN Support

```typescript
import { Dmn } from "@bpmnkit/core";

// Parse DMN XML
const dmnDefs = Dmn.parse(dmnXmlString);

// Create a minimal empty decision table
const empty = Dmn.makeEmpty();

// Export back to XML
const dmnXml = Dmn.export(dmnDefs);
```

## TypeScript Types

Key types exported from `@bpmnkit/core`:

```typescript
import type {
  BpmnDefinitions,
  BpmnProcess,
  CompactDiagram,
  LayoutResult,
  ProcessBuilder,
  DiagramBuilder,
  ServiceTaskOptions,
  UserTaskOptions,
  GatewayOptions,
} from "@bpmnkit/core";
```
