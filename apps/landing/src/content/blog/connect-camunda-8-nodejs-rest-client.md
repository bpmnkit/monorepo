---
title: "Connect to Camunda 8 from Node.js with a typed REST client"
description: "Deploy processes, start instances, and react to lifecycle events against Camunda 8 (Zeebe) using @bpmnkit/api's typed REST client."
pubDate: 2026-06-22
author: "BPMN Kit"
tags: ["camunda", "zeebe", "api"]
---

Camunda 8's REST API is large — deployment, process instances, user tasks,
incidents, decisions, and more. [`@bpmnkit/api`](https://docs.bpmnkit.com/packages/api/)
wraps it in a single typed client: 180 methods across 30+ resource classes, generated
from Camunda's own OpenAPI specification, so every request and response is typed.

## Connecting

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
```

OAuth2, Bearer, and Basic auth are all supported. Under the hood, the client caches
tokens (LRU + TTL) and retries transient failures with exponential backoff, so a
flaky network blip during a deploy doesn't fail the whole request.

## Deploying and starting a process

```typescript
// Deploy a process definition
await client.process.deploy({ resources: [{ content: xml }] });

// Start a new instance
const instance = await client.process.startInstance({
  bpmnProcessId: "my-flow",
  variables: { orderId: "ord-123" },
});
```

`xml` here can come from anywhere — including [a diagram generated with
`@bpmnkit/core`](/blog/generate-bpmn-diagrams-programmatically-typescript) in the same
process, so a build step can generate, [simulate](/blog/simulate-bpmn-process-without-camunda),
and deploy a process without leaving TypeScript.

## Observing what happens

The client is a `TypedEventEmitter`, so you can hook into the request lifecycle
without wrapping every call yourself:

```typescript
client.on("request", (e) => console.log(e.method, e.url));
client.on("error", (e) => metrics.inc("api.error"));
```

That's useful for logging, metrics, or feeding a dashboard — you get visibility into
every call the client makes against Camunda 8 without threading logging through each
call site.

## Where to go next

- [Simulate a BPMN process without Camunda](/blog/simulate-bpmn-process-without-camunda) — test before you deploy
- [`@bpmnkit/api` package reference](https://docs.bpmnkit.com/packages/api/) — full method list
- [`casen` CLI](/cli) — manage Camunda 8 from the terminal, built on this same client
