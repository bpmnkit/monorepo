# Gateways & Branching — Parallel Gateway (AND)

All outgoing paths run concurrently. A matching parallel join gateway waits for all paths
to complete before continuing:

```typescript
const xml = Bpmn.export(
  Bpmn.createProcess("order-fulfillment")
    .startEvent("start")
    .parallelGateway("split")
    .branch("warehouse", (b) =>
      b.serviceTask("pick", { taskType: "warehouse-pick", name: "Pick Items" })
    )
    .branch("payment", (b) =>
      b.serviceTask("charge", { taskType: "payment-charge", name: "Charge Card" })
    )
    .parallelGateway("join")   // waits for all branches
    .serviceTask("ship", { taskType: "shipping", name: "Ship Order" })
    .endEvent("end")
    .withAutoLayout()
    .build()
);
```

---
Source: https://bpmnkit.com/docs/guides/gateways
