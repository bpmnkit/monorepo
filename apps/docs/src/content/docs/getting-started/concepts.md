---
title: Core Concepts
description: Understand how the builder, serializer, auto-layout, and AI-compact format work.
---

## The Fluent Builder

`Bpmn.createProcess(id)` returns a `ProcessBuilder` — a chainable object that tracks the
current "cursor" position in the process graph. Each method call appends an element and
advances the cursor:

```typescript
import { Bpmn } from "@bpmn-sdk/core";

Bpmn.createProcess("my-process")
  .startEvent("start")       // cursor at startEvent
  .serviceTask("task-1")     // cursor at task-1; sequence flow start → task-1 added
  .endEvent("end")           // cursor at end; sequence flow task-1 → end added
  .build();
```

### Sequential flow

Methods like `.serviceTask()`, `.userTask()`, `.scriptTask()`, and `.endEvent()` all create an
element _and_ a sequence flow from the previous cursor position.

### Branches

`.exclusiveGateway()` and `.parallelGateway()` create a gateway and advance the cursor to it.
Use `.branch(id, builder)` to define outgoing paths:

```typescript
.exclusiveGateway("gw")
.branch("approved", (b) =>
  b.condition("= approved").serviceTask("notify").endEvent("done")
)
.branch("rejected", (b) =>
  b.defaultFlow().endEvent("rejected")
)
```

Each branch builder starts at the gateway. Branches merge automatically when two paths lead to
the same element.

## Auto-Layout

Call `.withAutoLayout()` before `.build()` to apply the Sugiyama layered graph algorithm.
It produces clean, left-to-right layouts without any coordinate math:

```typescript
const process = Bpmn.createProcess("flow")
  .startEvent("start")
  .serviceTask("work")
  .endEvent("end")
  .withAutoLayout()   // assigns x/y/width/height to all elements
  .build();
```

Under the hood, the layout algorithm:
1. Topologically sorts elements into layers
2. Assigns X coordinates based on layer depth
3. Assigns Y coordinates by crossing-minimisation within each layer
4. Adds waypoints to sequence flow edges

You can access element sizes via the `ELEMENT_SIZES` export if you need to build custom layouts.

## Parsing and Serializing

The SDK can round-trip any BPMN 2.0 XML — parse it, modify it in TypeScript, and export it back:

```typescript
import { Bpmn } from "@bpmn-sdk/core";

// Parse XML into a typed object
const definitions = Bpmn.parse(xmlString);

// Access the first process
const process = definitions.rootElements.find(
  (el) => el.$type === "bpmn:Process"
);

// Export back to XML
const newXml = Bpmn.export(definitions);
```

### Round-trip fidelity

The parser preserves all attributes, extensions, and vendor-specific elements. Exporting the
parsed object produces XML that is semantically equivalent to the input.

## AI-Compact Format

Raw BPMN XML is verbose — a simple three-node process takes ~60 lines of XML. The compact
format reduces this to a small JSON object that fits in a single LLM prompt:

```typescript
import { compactify, expand } from "@bpmn-sdk/core";

// Definitions → CompactDiagram (small JSON)
const compact = compactify(definitions);

// CompactDiagram → Definitions (full object)
const restored = expand(compact);
```

The compact format is designed for AI agents:
- Every element has an `id` and a human-readable `name`
- Sequence flows are represented as `{ from, to, condition? }` pairs
- Zeebe extensions (task type, IO mappings, headers) are inlined
- The full diagram of a typical approval workflow fits in ~500 tokens

## Zeebe Extensions

Camunda 8 (Zeebe) uses XML extension elements for its engine-specific config.
The builder exposes these as first-class TypeScript options:

```typescript
.serviceTask("send-email", {
  name: "Send Confirmation Email",
  taskType: "io.camunda.connectors.SMTP.v1",   // connector type
  taskHeaders: {
    from: "noreply@example.com",
    subject: "Your order is confirmed",
  },
  inputMappings: [
    { source: "= orderId", target: "orderId" },
    { source: "= customer.email", target: "to" },
  ],
  outputMappings: [
    { source: "= messageId", target: "emailMessageId" },
  ],
})
```
