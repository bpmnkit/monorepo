# Gateways & Branching — Branching Inside Sub-Processes

The full gateway and branching API works inside `subProcess()` callbacks too:

```typescript
.subProcess("handle-request", (sub) =>
  sub
    .startEvent("s")
    .exclusiveGateway("route")
    .branch("fast-path", (b) =>
      b.condition("= priority == \"high\"")
        .serviceTask("express", { taskType: "express-handler" })
        .endEvent("done-fast"),
    )
    .branch("normal", (b) =>
      b.defaultFlow()
        .serviceTask("standard", { taskType: "standard-handler" })
        .endEvent("done-normal"),
    )
)
```

Auto-join gateway insertion applies inside sub-processes the same way it does at the
top level — converging branches automatically get a matching join gateway.

---
Source: https://docs.bpmnkit.com/guides/gateways/
