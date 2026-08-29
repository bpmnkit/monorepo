# Simulation

The `@bpmnkit/engine` package is a zero-dependency BPMN simulation engine that runs in
browsers and Node.js. It's useful for:

- **Testing** process logic before deploying
- **Prototyping** without a Camunda cluster
- **CI pipelines** — unit-test your process definitions
- **Demos** — run live in a browser


## Basic Usage

```typescript
import { Engine } from "@bpmnkit/engine";
import { Bpmn } from "@bpmnkit/core";

// Build a process
const xml = Bpmn.export(
  Bpmn.createProcess("order")
    .startEvent("start")
    .serviceTask("charge", { taskType: "payment" })
    .serviceTask("ship", { taskType: "shipping" })
    .endEvent("end")
    .build()
);

// Create engine and deploy
const engine = new Engine();
await engine.deploy({ bpmn: xml });

// Register workers
engine.registerJobWorker("payment", async (job) => {
  console.log("Charging card...", job.variables);
  await job.complete({ transactionId: "txn-123" });
});

engine.registerJobWorker("shipping", async (job) => {
  console.log("Shipping order...", job.variables);
  await job.complete({ trackingNumber: "1Z999AA1" });
});

// Start an instance
const instance = engine.start("order", {
  orderId: "ord-456",
  amount: 99.99,
});
```

---
Source: https://bpmnkit.com/docs/guides/simulation
