# Core Concepts — The Fluent Builder

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

---
Source: https://bpmnkit.com/docs/getting-started/concepts
