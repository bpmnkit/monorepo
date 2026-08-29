# Quick Start

This guide walks you from zero to a deployed, running BPMN process in three steps.


## Step 1: Create a process

Use the fluent builder to describe your process in TypeScript:

```typescript
import { Bpmn } from "@bpmnkit/core";

const xml = Bpmn.export(
  Bpmn.createProcess("hello")
    .startEvent("start")
    .serviceTask("task", {
      name: "Hello World",
      taskType: "greet",   // Zeebe worker type
    })
    .endEvent("end")
    .withAutoLayout()      // apply Sugiyama layout
    .build()
);

console.log(xml); // valid BPMN 2.0 XML
```

The `xml` string is a complete, valid BPMN 2.0 document that any standards-compliant engine can load.

---
Source: https://bpmnkit.com/docs/getting-started/quick-start
