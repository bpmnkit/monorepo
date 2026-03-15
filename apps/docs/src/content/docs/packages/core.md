---
title: "@bpmnkit/core"
description: Fluent process builder, BPMN 2.0 parser/serializer, auto-layout, and AI-compact format.
---

## Overview

`@bpmnkit/core` is the foundation of BPMN Kit. It provides everything needed to work with
BPMN 2.0 programmatically:

- **Fluent builder** — chain method calls to construct any process shape
- **Parser/serializer** — round-trip any BPMN 2.0 XML with full fidelity
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

### `compactify(definitions)`

Converts a `BpmnDefinitions` object to a `CompactDiagram` — a small JSON object
suitable for LLM prompts.

```typescript
import { compactify } from "@bpmnkit/core";

const compact = compactify(Bpmn.parse(xml));
```

### `expand(compact)`

Converts a `CompactDiagram` back to a `BpmnDefinitions` object.

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
| `.withAutoLayout()` | Apply Sugiyama layout before building |
| `.build()` | Return the completed `BpmnProcess` |

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
  ServiceTaskOptions,
  UserTaskOptions,
  GatewayOptions,
} from "@bpmnkit/core";
```
