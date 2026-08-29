# Quick Start — Step 3: Deploy to Camunda 8

When you're ready for production, deploy to a real Camunda 8 cluster:

```typescript
import { CamundaClient } from "@bpmnkit/api";

const client = new CamundaClient({
  baseUrl: "https://api.cloud.camunda.io",
  auth: {
    type: "oauth2",
    clientId: process.env.CAMUNDA_CLIENT_ID,
    clientSecret: process.env.CAMUNDA_CLIENT_SECRET,
    audience: process.env.CAMUNDA_AUDIENCE,
  },
});

// Deploy the process definition
await client.process.deploy({
  resources: [{ content: xml, name: "hello.bpmn" }],
});

// Start a new process instance
const instance = await client.process.startInstance({
  bpmnProcessId: "hello",
  variables: { greeting: "world" },
});

console.log("Started instance:", instance.processInstanceKey);
```

---
Source: https://bpmnkit.com/docs/getting-started/quick-start
