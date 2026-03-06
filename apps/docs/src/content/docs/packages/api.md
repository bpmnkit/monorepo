---
title: "@bpmn-sdk/api"
description: Fully-typed Camunda 8 REST API client with OAuth2, caching, and retry.
---

## Overview

`@bpmn-sdk/api` is a complete TypeScript client for the Camunda 8 Orchestration Cluster
REST API:

- **180 typed methods** across 30+ resource classes
- **Auth**: OAuth2, Bearer token, Basic, and no-auth
- **LRU+TTL cache** for read-heavy operations
- **Exponential backoff** with configurable retry
- **TypedEventEmitter** for observability hooks
- Zero transitive runtime dependencies

## Installation

```sh
pnpm add @bpmn-sdk/api
```

## Client Configuration

```typescript
import { CamundaClient } from "@bpmn-sdk/api";

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

## Resource Namespaces

All methods are grouped by resource type:

| Namespace | Methods |
|---|---|
| `client.process` | deploy, startInstance, listInstances, getInstance, cancel, migrate |
| `client.jobs` | activate, complete, fail, throwError, activateAndProcess |
| `client.incidents` | list, resolve, get |
| `client.variables` | list, get, update |
| `client.decisions` | evaluate, list, getInstance |
| `client.messages` | publish, correlate |
| `client.signals` | broadcast |
| `client.userTasks` | list, get, complete, assign, claim |
| `client.users` | list, get, create, delete |
| `client.groups` | list, get, create, assignMember |
| `client.authorizations` | list, create, delete |

## Process Operations

```typescript
// Deploy
const deployed = await client.process.deploy({
  resources: [{ content: bpmnXml, name: "my-flow.bpmn" }],
});

// Start instance
const instance = await client.process.startInstance({
  bpmnProcessId: "my-flow",
  variables: { customerId: "cust-001" },
});

// List active instances
const { items } = await client.process.listInstances({
  state: "ACTIVE",
  bpmnProcessId: "my-flow",
});

// Cancel instance
await client.process.cancel({
  processInstanceKey: instance.processInstanceKey,
});
```

## Job Workers

```typescript
// Activate and handle jobs in a poll loop
const worker = await client.jobs.activateAndProcess({
  type: "send-email",
  maxJobsToActivate: 10,
  timeout: 60_000,          // job lock duration in ms
  worker: "email-worker-1",

  handler: async (job) => {
    try {
      await sendEmail(job.variables);
      await client.jobs.complete({
        jobKey: job.key,
        variables: { emailSent: true },
      });
    } catch (err) {
      await client.jobs.fail({
        jobKey: job.key,
        errorMessage: String(err),
        retries: job.retries - 1,
      });
    }
  },
});

// Stop polling
worker.close();
```

## Incident Resolution

```typescript
// Find all incidents for a process instance
const { items: incidents } = await client.incidents.list({
  processInstanceKey: instance.processInstanceKey,
});

// Fix the problem in your code, then resolve
for (const incident of incidents) {
  await client.incidents.resolve({ incidentKey: incident.key });
}
```

## Message Correlation

```typescript
await client.messages.publish({
  messageName: "payment-confirmed",
  correlationKey: "ord-456",
  variables: {
    paymentMethod: "card",
    confirmedAt: new Date().toISOString(),
  },
  timeToLive: 60_000,   // ms — how long to wait for a matching instance
});
```

## Observability Events

```typescript
type ClientEvent = "request" | "response" | "error" | "retry" | "token-refresh";

client.on("request",  (e) => logger.debug(e.method, e.url));
client.on("response", (e) => metrics.histogram("api.latency", e.durationMs));
client.on("error",    (e) => logger.error(e.status, e.url, e.body));
client.on("retry",    (e) => logger.warn(`Retrying ${e.url} (attempt ${e.attempt})`));
```
