# @bpmnkit/core — Installation — `diffDiagram(before, after)`

What a *reviewer* would see change — `diffSemantics()` plus the layout half it deliberately
ignores, restricted to elements a canvas can actually draw.

```typescript
import { diffDiagram } from "@bpmnkit/core";

const result = diffDiagram(before, after);
result.added;    // ids only in `after`
result.removed;  // ids only in `before`
result.changed;  // same element, different semantics
result.moved;    // same semantics, different place on the canvas
result.total;
result.planes;   // per-plane breakdown — a change inside a collapsed sub-process
                 // is invisible in a viewer until the reader drills into it
```

`moved` is why this exists. The semantic hash drops all diagram interchange — that is what
makes it stable across a re-layout — so a task somebody dragged reads as no change at all in
`diffSemantics()`. Here the geometry is compared separately from DI (bounds, waypoints, label
placement, and flags such as collapsed/expanded). An element that changed *and* moved is
reported as changed, since a semantic change is what a reviewer needs first.

An element with nothing to draw on either side is left out, so a changed `targetNamespace`
cannot inflate a count against nothing on screen.

The same comparison is [`casen diff bpmn`](/docs/cli/diff) on the command line,
`createBpmnDiff()` in `@bpmnkit/plugins` on a pair of canvases, and *Compare Diagram with
HEAD* in the [VS Code extension](/docs/guides/vscode).

---
Source: https://bpmnkit.com/docs/packages/core
