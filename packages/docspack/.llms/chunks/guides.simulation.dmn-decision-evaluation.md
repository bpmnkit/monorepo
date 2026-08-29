# Simulation — DMN Decision Evaluation

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

---
Source: https://bpmnkit.com/docs/guides/simulation
