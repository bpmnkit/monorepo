---
title: Quick Start
description: Build and run your first BPMN process in minutes.
sidebar:
  order: 2
---

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

## Step 2: Simulate locally

The simulation engine runs the process right in Node.js — no Camunda cluster required:

```typescript
import { Engine } from "@bpmnkit/engine";

const engine = new Engine();
await engine.deploy({ bpmn: xml });

// Register a job worker for the "greet" service task
engine.registerJobWorker("greet", async (job) => {
  console.log("Hello from the worker!");
  await job.complete({ greeting: "Hello!" });
});

const instance = engine.start("hello");

// Wait for the process to finish
await new Promise<void>((resolve) => {
  instance.onChange((state) => {
    if (state === "completed") resolve();
  });
});
```

## Step 3: Deploy to Camunda 8

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

## What's next?

- [AI-Driven Implementation](/docs/guides/ai-implement) — let Claude implement processes end-to-end from a description
- [Core Concepts](/docs/getting-started/concepts) — understand how the builder, layout, and roundtrip work
- [Building Processes](/docs/guides/building-processes) — tasks, events, sub-processes, and markers
- [Gateways & Branching](/docs/guides/gateways) — exclusive, parallel, and event-based gateways

> **AI-first workflow** — if you have Claude Code, the fastest path is `casen skills install`
> then `/implement <description>`. Claude generates the BPMN, scaffolds workers, and deploys —
> all from a single prompt.
