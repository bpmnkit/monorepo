---
title: Camunda 8 Deployment
description: Deploy and manage BPMN processes on a live Camunda 8 cluster using @bpmn-sdk/api.
---

The `@bpmn-sdk/api` package is a fully-typed Camunda 8 REST API client. Use it to deploy
processes, start instances, and manage your cluster from Node.js scripts, backend services,
or CI/CD pipelines.

## Setup

### SaaS (Camunda 8 Cloud)

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

## Deploying a Process

```typescript
import { Bpmn } from "@bpmn-sdk/core";
import { CamundaClient } from "@bpmn-sdk/api";

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

## Handling Jobs

Register a long-poll job worker to process service tasks:

```typescript
const subscription = await client.jobs.activateAndProcess({
  type: "send-email",
  maxJobsToActivate: 5,
  timeout: 30_000,
  worker: "email-service",

  handler: async (job) => {
    const { to, subject, body } = job.variables;

    await sendEmail({ to, subject, body });

    await client.jobs.complete({
      jobKey: job.key,
      variables: { sent: true, sentAt: new Date().toISOString() },
    });
  },
});

// Stop the worker
subscription.close();
```

## Querying Instances

```typescript
// List running instances
const instances = await client.process.listInstances({
  bpmnProcessId: "invoice-approval",
  state: "ACTIVE",
});

// Get a specific instance
const instance = await client.process.getInstance({
  processInstanceKey: "2251799813685249",
});

// Get variables
const variables = await client.variables.list({
  processInstanceKey: instance.key,
});
```

## Managing Incidents

```typescript
// List open incidents
const incidents = await client.incidents.list({
  state: "ACTIVE",
});

// Resolve an incident (after fixing the underlying issue)
await client.incidents.resolve({ incidentKey: incident.key });
```

## Lifecycle Events

Use the TypedEventEmitter to react to API events:

```typescript
client.on("request", (e) => {
  console.log(`→ ${e.method} ${e.url}`);
});

client.on("response", (e) => {
  console.log(`← ${e.status} in ${e.durationMs}ms`);
});

client.on("error", (e) => {
  metrics.increment("camunda.api.error", { url: e.url });
});
```

## CI/CD: Deploy on Push

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
import { Bpmn } from "@bpmn-sdk/core";
import { CamundaClient } from "@bpmn-sdk/api";
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
