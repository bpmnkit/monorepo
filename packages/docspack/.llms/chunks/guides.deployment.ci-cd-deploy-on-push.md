# Camunda 8 Deployment — CI/CD: Deploy on Push

A typical GitHub Actions step:

```yaml
- name: Deploy BPMN processes
  run: node scripts/deploy.mjs
  env:
    CAMUNDA_CLIENT_ID: ${{ secrets.CAMUNDA_CLIENT_ID }}
    CAMUNDA_CLIENT_SECRET: ${{ secrets.CAMUNDA_CLIENT_SECRET }}
    CAMUNDA_AUDIENCE: ${{ secrets.CAMUNDA_AUDIENCE }}
    CAMUNDA_TOKEN_URL: ${{ secrets.CAMUNDA_TOKEN_URL }}
```

```typescript
// scripts/deploy.mjs
import { Bpmn } from "@bpmnkit/core";
import { CamundaClient } from "@bpmnkit/api";
import { readdir, readFile } from "node:fs/promises";

const client = new CamundaClient({
  baseUrl: "https://api.cloud.camunda.io",
  auth: {
    type: "oauth2",
    clientId: process.env.CAMUNDA_CLIENT_ID,
    clientSecret: process.env.CAMUNDA_CLIENT_SECRET,
    audience: process.env.CAMUNDA_AUDIENCE,
    tokenUrl: process.env.CAMUNDA_TOKEN_URL,
  },
});

const files = await readdir("./processes");
const resources = await Promise.all(
  files
    .filter((f) => f.endsWith(".bpmn"))
    .map(async (f) => ({
      name: f,
      content: await readFile(`./processes/${f}`, "utf8"),
    }))
);

const result = await client.process.deploy({ resources });
console.log(`Deployed ${result.deployments.length} processes`);
```

---
Source: https://docs.bpmnkit.com/guides/deployment/
