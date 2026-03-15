---
title: Simulation
description: Run BPMN processes locally with @bpmnkit/engine — no Camunda cluster required.
---

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

## Instance State

The `ProcessInstance` object tracks the running state:

```typescript
const instance = engine.start("order");

console.log(instance.state);          // "running" | "completed" | "cancelled"
console.log(instance.activeElements); // Set<string> — currently active element IDs

// Subscribe to state changes
instance.onChange((newState) => {
  console.log("State changed to:", newState);
});
```

## Variables

Variables flow through the process via IO mappings. You can read the current snapshot:

```typescript
const vars = instance.variables_snapshot;
console.log(vars.orderId);       // input variable
console.log(vars.transactionId); // output from a task
```

## Message Correlation

Deliver a message to a waiting `intermediateCatchEvent`:

```typescript
// Process has a catch event waiting for "payment-confirmed"
await instance.deliverMessage("payment-confirmed", {
  paymentMethod: "card",
  confirmedAt: new Date().toISOString(),
});
```

## Step-by-Step Execution

Use the `beforeComplete` hook to pause execution between elements — useful for debugging
and building animated process runners:

```typescript
const instance = engine.start("order", {}, {
  beforeComplete: async (elementId) => {
    console.log("About to complete:", elementId);
    // Inspect state, update UI, etc.
    // Resume by returning from this function
  },
});
```

## DMN Decision Evaluation

Deploy decision tables alongside the process:

```typescript
await engine.deploy({
  bpmn: xml,
  decisions: [dmnXml],   // DMN 1.3 XML strings
});
```

## Testing with Vitest

Write deterministic unit tests for your process logic:

```typescript
import { describe, it, expect } from "vitest";
import { Engine } from "@bpmnkit/engine";
import { buildOrderProcess } from "./processes.js";

describe("order process", () => {
  it("completes when payment succeeds", async () => {
    const engine = new Engine();
    await engine.deploy({ bpmn: buildOrderProcess() });

    let completed = false;

    engine.registerJobWorker("payment", async (job) => {
      await job.complete({ success: true });
    });

    engine.registerJobWorker("shipping", async (job) => {
      await job.complete({ trackingNumber: "TRK-001" });
    });

    const instance = engine.start("order", { amount: 50 });
    await new Promise<void>((resolve) => {
      instance.onChange((state) => {
        if (state === "completed") { completed = true; resolve(); }
      });
    });

    expect(completed).toBe(true);
    expect(instance.variables_snapshot.trackingNumber).toBe("TRK-001");
  });
});
```

## Multiple Deployments

The engine supports multiple deployed processes. Use `engine.getDeployedProcesses()` to list them:

```typescript
await engine.deploy({ bpmn: processAXml });
await engine.deploy({ bpmn: processBXml });

const processes = engine.getDeployedProcesses();
// [{ id: "process-a", name: "..." }, { id: "process-b", name: "..." }]
```
