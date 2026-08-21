# Building Processes — Call Activities

Invoke a separate (reusable) process definition:

```typescript
.callActivity("run-subprocess", {
  name: "Run Fulfillment Sub-Process",
  calledElement: "fulfillment-process",
  propagateAllChildVariables: false,
  inputMappings: [
    { source: "= orderId", target: "orderId" },
  ],
  outputMappings: [
    { source: "= trackingNumber", target: "trackingNumber" },
  ],
})
```


## Multi-Process Diagrams

`Bpmn.createDiagram()` assembles multiple processes into a single definitions document.
This is useful for caller/callee pairs or any workflow that references another process:

```typescript
import { Bpmn } from "@bpmnkit/core";

const defs = Bpmn.createDiagram("OrderSystem")
  .process("order-flow", (p) =>
    p
      .startEvent("start")
      .callActivity("run-payment", { processId: "payment-flow" })
      .endEvent("end"),
  )
  .process("payment-flow", (p) =>
    p
      .startEvent("s")
      .serviceTask("charge", { name: "Charge", taskType: "payment-charge" })
      .endEvent("e"),
  )
  .build();

const xml = Bpmn.export(defs); // both processes in one XML file
```

---
Source: https://docs.bpmnkit.com/guides/building-processes/
