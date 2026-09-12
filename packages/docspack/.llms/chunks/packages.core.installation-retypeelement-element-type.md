# @bpmnkit/core — Installation — `retypeElement(element, type)`

Returns a copy of a flow element with a different `type`, keeping its id, name, documentation
and — crucially — its incoming and outgoing sequence flows. Use this to change a task's type
instead of removing and re-adding the element, which drops the wiring.

```typescript
import { retypeElement } from "@bpmnkit/core";

const index = process.flowElements.findIndex((el) => el.id === "charge");
process.flowElements[index] = retypeElement(process.flowElements[index], "manualTask");
```

Nested content is carried between container types, and a multi-instance marker between types
that both allow one. Zeebe extensions the new type cannot legally hold are dropped, using the
same placement table `ensureZeebeExtension` enforces — so a `serviceTask` retyped to
`manualTask` does not keep a job worker the engine would refuse.

---
Source: https://bpmnkit.com/docs/packages/core
