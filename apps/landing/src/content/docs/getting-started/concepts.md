---
title: Core Concepts
description: Understand how the builder, serializer, auto-layout, and AI-compact format work.
sidebar:
  order: 3
---

## The Fluent Builder

`Bpmn.createProcess(id)` returns a `ProcessBuilder` — a chainable object that tracks the
current "cursor" position in the process graph. Each method call appends an element and
advances the cursor:

```typescript
import { Bpmn } from "@bpmnkit/core";

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

Parse BPMN 2.0 XML into a typed object, modify it in TypeScript, and export it back:

```typescript
import { Bpmn, findProcess } from "@bpmnkit/core";

// Parse XML into a typed object
const definitions = Bpmn.parse(xmlString);

// Access the first process, or look one up by id
const process = definitions.processes[0];
const approval = findProcess(definitions, "approval-flow");

// Export back to XML
const newXml = Bpmn.export(definitions);
```

### Round-trip fidelity

`Bpmn.parse()` → `Bpmn.export()` preserves the document. Content the SDK models round-trips
through its typed fields; content it does not model is kept verbatim and re-emitted:

- **Unmodelled attributes** land in `unknownAttributes` on the element that carried them.
- **Unmodelled children** of `definitions`, a `process`, a `collaboration` or a flow node land
  in `unknownChildren` — so `bpmn:import`, `bpmn:itemDefinition`, `bpmn:ioSpecification`,
  `bpmn:correlationKey`, `bpmn:potentialOwner` and vendor elements outside `extensionElements`
  all survive, including their nested content.
- **`extensionElements`** are kept as raw `XmlElement` trees wherever BPMN allows them,
  including on root-level `message`, `error`, `escalation` and `signal` elements — which is
  what carries `zeebe:subscription` correlation keys.

`semanticHash(definitions)` gives you this as a check you can run yourself: it hashes the
model with the diagram excluded, so `semanticHash(applyAutoLayout(defs))` equals
`semanticHash(defs)`, and any difference means the model changed rather than the layout.

A corpus of BPMN documents is round-tripped on every build and compared structurally —
element counts, per-element attribute names, parent/child nesting and text content — by a
scanner written independently of the parser, so a regression fails CI rather than reaching a
release. See `packages/core/tests/roundtrip-corpus.test.ts`.

**Deliberate normalisations.** The output is not byte-identical to the input, and two rewrites
are intentional:

- `isExecutable="false"` and `isSequential="false"` are written only when true. BPMN treats
  the absent attribute as false, so this is stable and changes nothing.
- Empty `<extensionElements/>` elements are dropped, and whitespace and attribute order are
  not preserved.

**Still not preserved.** Unmodelled *children* are captured on `definitions`, `process`,
`collaboration` and flow nodes only. On other elements — lanes, artifacts, root-level
messages and errors — `documentation` and `extensionElements` round-trip, but any other
unrecognised child does not. A second `<documentation>` on the same element is also dropped;
only the first is kept. If you need one of these, open an issue rather than working around it.

## AI-Compact Format

Raw BPMN XML is verbose — a simple three-node process takes ~60 lines of XML. The compact
format reduces this to a small JSON object that fits in a single LLM prompt:

```typescript
import { compactify, expand } from "@bpmnkit/core";

// Definitions → CompactDiagram (small JSON)
const compact = compactify(definitions);

// CompactDiagram → Definitions (full object)
const restored = expand(compact);
```

The compact format is designed for AI agents:
- Every element has an `id` and a human-readable `name`
- Sequence flows are represented as `{ from, to, condition? }` pairs
- Common Zeebe extensions (task type, headers, form and decision bindings) are inlined
- The full diagram of a typical approval workflow fits in ~500 tokens

> **`compactify()` is a lossy view, not a round trip.** `CompactElement` models about fifteen
> properties, so `expand(compactify(definitions))` is not `definitions`: collaborations,
> participants, message flows, lanes, data stores, artifacts, root-level messages and errors,
> multi-instance loop characteristics, full `zeebe:ioMapping` entries and most diagram
> interchange do not survive it.
>
> Use it to **show** a model to an LLM and to build a **new** model from one. Do not use it as
> an edit path for a file you need to keep — read the file, apply the change to the
> `BpmnDefinitions`, and export that. For the same reason `casen generate bpmn --input`
> refuses to overwrite its input unless you pass `--force`.

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
