---
"@bpmnkit/core": minor
---

`CompactFlow` can name a gateway's default flow. It carried `condition` but had no field for `bpmn:default`, so a model returning a `CompactDiagram` — the format BPMN Kit asks it for — could not mark a fallthrough branch however well it had read the documentation, and an exclusive gateway whose conditions are all false and which has no default deadlocks at runtime. `compactify` also dropped an existing default, so a round trip lost it.

The branch carries `isDefault: true` rather than the gateway pointing at a flow id, because that is where its alternative, `condition`, already sits:

```typescript
flows: [
  { id: "f5", from: "needsApproval", to: "approve", condition: "= total > 10000" },
  { id: "f6", from: "needsApproval", to: "fulfil", isDefault: true },
]
```

`expand` turns it into the attribute, `compactify` reads it back, and `reconcileCompact` sets or clears it on a model it did not author. A flow marked `isDefault` that does not leave an exclusive, inclusive or complex gateway, or a gateway marking two, throws rather than being dropped — a default that goes missing surfaces as a deadlock with no trace back to here.

`buildFlowElement` takes the default flow id as an optional fourth argument, and `defaultFlows(elements, flows)` is exported for callers deriving the same mapping.
