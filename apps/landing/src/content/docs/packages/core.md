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

### `applyBpmnOperations(definitions, operations, options?)`

Applies edit operations to the full model. The operation vocabulary is the same one an LLM
produces; applying it here rather than to a `CompactDiagram` means an edit touches only what it
names and leaves the document's pools, lanes, data wiring and Zeebe detail alone.

```typescript
import { applyBpmnOperations } from "@bpmnkit/core";

const { definitions, applied } = applyBpmnOperations(parsed, [
  { op: "rename", id: "Task_1", name: "Approve invoice" },
  { op: "update", id: "Task_1", patch: { jobType: "approve" } },
]);
```

**Strict by default.** An operation naming an element that does not exist throws an
`OperationError` and nothing is applied — the previous implementation skipped such operations
silently, so a patch with a misspelled id reported success and changed nothing. Pass
`{ strict: false }` to get `{ definitions, applied, problems }` instead and decide for
yourself. The input is never mutated either way.

### `ensureZeebeExtension(owner, extension)`

Finds a Zeebe extension element on a flow element, creating it if absent, and refuses a
placement the Zeebe schema does not allow. Use it instead of pushing onto `extensionElements`
directly: the push cannot fail, so `zeebe:calledDecision` on a service task becomes a deploy
error in Camunda rather than a throw where it was written.

```typescript
import { ensureZeebeExtension, ZeebePlacementError } from "@bpmnkit/core";

ensureZeebeExtension(serviceTask, "zeebe:taskDefinition").attributes.type = "worker";
ensureZeebeExtension(serviceTask, "zeebe:calledDecision"); // throws ZeebePlacementError
```

`ZeebePlacementError` carries `ownerElement`, `extension` and `allowedOn`, so the message
names the elements that *would* have been valid.

`isZeebePlacementAllowed(ownerElement, extension)` answers the same question without throwing,
and `ZEEBE_PLACEMENT` is the table itself — extension name to the element names that may own it.

The table is generated from `zeebe.json`'s `meta.allowedIn` (`zeebe-bpmn-moddle`, MIT),
resolved against the BPMN type graph, so it states the schema's rules rather than ours. **An
extension the schema says nothing about is allowed**: the descriptor declares no owner for
`zeebe:subscription` or `zeebe:properties`, and inventing a rule there would reject valid
documents. Non-`zeebe:` extensions are not checked at all.

`applyBpmnOperations` runs the same check, and reports a misplaced extension as an ordinary
operation problem — checked before anything is written, so the element is left untouched and
the rest of the batch still applies.

### `reconcileCompact(definitions, compact, options?)`

Applies a `CompactDiagram` to an existing model as a set of changes. Elements that already
exist are patched in place and keep their extensions, new ones are inserted, and ones the input
no longer mentions are removed — where `expand(compact)` would rebuild the whole document and
discard everything the compact form cannot describe.

Processes are only added, never removed: sending one process of a multi-process document means
"this is how that process should look", not "delete the others".

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

## Writing files — `@bpmnkit/core/node`

Anything that touches the filesystem lives behind the `@bpmnkit/core/node` subpath, so
importing `@bpmnkit/core` itself never pulls `node:` builtins into a browser bundle.

### `writeBpmn(definitions, options)`

The only supported way to write a BPMN file, and the only one that checks what it wrote.
Before anything reaches disk it serialises the model, **parses the result back**, and compares
the semantic hashes. If they differ the write is refused and nothing is written.

```typescript
import { writeBpmn } from "@bpmnkit/core/node";
import { WriteError, WriteVerificationError } from "@bpmnkit/core";

const result = await writeBpmn(definitions, {
  output: "flow.bpmn",
  force: false,        // default — refuses rather than replace an existing file
  layout: "preserve",  // default — "auto" regenerates the diagram first
});

result.destination;    // absolute path written
result.semanticHash;   // the model's hash, verified after reading it back
result.outputSha256;   // digest of the exact bytes on disk
result.changes;        // what this write changed about the file it replaced
```

The file appears complete or not at all: contents go to a temporary file in the destination's
own directory and are then linked or renamed into place, so an interrupted write cannot leave
a half-written model behind. Two concurrent writes to the same new path cannot both succeed.

`WriteVerificationError` carries a `changes` field naming the elements that diverged.
`WriteError` means the destination exists and `force` was not given, or the filesystem refused.

**What the check does not cover.** It compares the model in memory against the model read back
from the output, so it catches the serialiser losing something. It cannot catch the *parser*
having dropped something on the way in — content the parser never saw is absent from both
sides. That is what the round-trip corpus gate covers, and there is deliberately no option to
skip verification: turning it off would only ever be used to get past the bug it exists to
report. If you want unchecked serialisation, `Bpmn.export()` still returns a string.

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
