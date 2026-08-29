# Quick Start — Step 2: Simulate locally

The simulation engine runs the process right in Node.js — no Camunda cluster required:

```typescript
import { Engine } from "@bpmnkit/engine";

const engine = new Engine();
await engine.deploy({ bpmn: xml });

// Register a job worker for the "greet" service task
engine.registerJobWorker("greet", async (job) => {
  console.log("Hello from the worker!");
  await job.complete({ greeting: "Hello!" });
});

const instance = engine.start("hello");

// Wait for the process to finish
await new Promise<void>((resolve) => {
  instance.onChange((state) => {
    if (state === "completed") resolve();
  });
});
```

---
Source: https://bpmnkit.com/docs/getting-started/quick-start
