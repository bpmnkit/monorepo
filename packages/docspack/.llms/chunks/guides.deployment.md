# Camunda 8 Deployment

The `@bpmnkit/api` package is a fully-typed Camunda 8 REST API client. Use it to deploy
processes, start instances, and manage your cluster from Node.js scripts, backend services,
or CI/CD pipelines.


## Setup

### SaaS (Camunda 8 Cloud)

```typescript
import { CamundaClient } from "@bpmnkit/api";

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
```

### Self-Managed

```typescript
const client = new CamundaClient({
  baseUrl: "http://localhost:8080",
  auth: {
    type: "bearer",
    token: process.env.ZEEBE_TOKEN,
  },
});
```

### No Auth (local dev)

```typescript
const client = new CamundaClient({
  baseUrl: "http://localhost:8080",
  auth: { type: "none" },
});
```

---
Source: https://bpmnkit.com/docs/guides/deployment
