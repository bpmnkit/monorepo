# Camunda 8 Deployment — Deploying a Process

```typescript
import { Bpmn } from "@bpmnkit/core";
import { CamundaClient } from "@bpmnkit/api";

const xml = Bpmn.export(
  Bpmn.createProcess("invoice-approval")
    .startEvent("start")
    .userTask("review", { name: "Review Invoice" })
    .endEvent("end")
    .withAutoLayout()
    .build()
);

const result = await client.process.deploy({
  resources: [
    { content: xml, name: "invoice-approval.bpmn" },
  ],
});

console.log("Deployed version:", result.deployments[0]?.processDefinition?.version);
```


## Starting Process Instances

```typescript
const instance = await client.process.startInstance({
  bpmnProcessId: "invoice-approval",
  variables: {
    invoiceId: "inv-1234",
    amount: 2500,
    submittedBy: "alice@example.com",
  },
});

console.log("Instance key:", instance.processInstanceKey);
```

### With a Specific Version

```typescript
const instance = await client.process.startInstance({
  bpmnProcessId: "invoice-approval",
  version: 2,
  variables: { invoiceId: "inv-5678" },
});
```

---
Source: https://bpmnkit.com/docs/guides/deployment
