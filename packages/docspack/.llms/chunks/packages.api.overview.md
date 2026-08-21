# @bpmnkit/api — Overview

`@bpmnkit/api` is a complete TypeScript client for the Camunda 8 Orchestration Cluster
REST API:

- **180 typed methods** across 30+ resource classes
- **Auth**: OAuth2, Bearer token, Basic, and no-auth
- **LRU+TTL cache** for read-heavy operations
- **Exponential backoff** with configurable retry
- **TypedEventEmitter** for observability hooks
- Zero transitive runtime dependencies


## Installation

```sh
pnpm add @bpmnkit/api
```


## Client Configuration

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
  // Optional:
  cache: {
    maxSize: 500,     // LRU cache size (default: 200)
    ttlMs: 30_000,    // cache TTL in ms (default: 60_000)
  },
  retry: {
    maxAttempts: 3,   // default: 3
    initialDelayMs: 200,
    maxDelayMs: 5_000,
  },
});
```

---
Source: https://docs.bpmnkit.com/packages/api/
