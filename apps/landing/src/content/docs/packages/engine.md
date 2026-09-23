---
title: "@bpmnkit/engine"
description: Zero-dependency BPMN simulation engine for browsers and Node.js.
sidebar:
  order: 2
---

## Overview

`@bpmnkit/engine` is a lightweight BPMN 2.0 process *simulator* that runs entirely in the
JavaScript runtime — no external services required. It is built for tests, demos and
step-through debugging, not for running production processes.

**What the TypeScript simulator executes:**
- Service and user tasks (dispatched to registered job workers), script tasks (FEEL),
  business rule tasks (DMN); manual, send, receive and plain tasks pass straight through
- Exclusive (with default flow), parallel and inclusive gateways
- None start events; none, terminate and error end events
- Intermediate catch events: timer (ISO 8601 duration, date and cycle) and message
- Boundary events: interrupting timer, and error
- Embedded sub-processes and transactions, with child variable scopes
- Zeebe IO mappings, and DMN decisions through `@bpmnkit/feel`

**What it does not execute.** Call activities, event sub-processes, event-based and complex
gateways, and ad-hoc sub-processes without a task definition are *completed without their
semantics* — the token moves on. Signal, escalation, compensation, conditional and link
events, multi-instance, message boundary events and non-interrupting boundary events are not
modelled. For Zeebe semantics, `@bpmnkit/engine/wasm-runner` runs the same scenarios on the
Reebe engine compiled to WebAssembly (experimental).

Zero runtime dependencies. ESM-only.

## Installation

```sh
pnpm add @bpmnkit/engine
```

## API Reference

### `new Engine()`

Creates a new engine instance. Each instance has its own process registry and running instances.

### `engine.deploy(options)`

Deploys one or more process and decision definitions:

```typescript
await engine.deploy({
  bpmn: bpmnXmlString,         // required
  forms: [formSchemaJson],     // optional: Camunda form schemas
  decisions: [dmnXmlString],   // optional: DMN decision tables
});
```

### `engine.start(processId, variables?, options?)`

Starts a new process instance:

```typescript
const instance = engine.start("my-process", {
  orderId: "ord-123",
  amount: 99.99,
});
```

**`StartOptions`:**

```typescript
type StartOptions = {
  beforeComplete?: (elementId: string) => Promise<void>;
};
```

The `beforeComplete` hook fires after a task has been executed but before the process
advances. Use it to pause for step-by-step execution or to inspect state mid-run.

### `engine.registerJobWorker(type, handler)`

Register a synchronous or asynchronous handler for service tasks of a given type:

```typescript
engine.registerJobWorker("send-email", async (job) => {
  await mailer.send({
    to: job.variables.recipient,
    subject: job.variables.subject,
  });

  // Complete the job (advances the process)
  await job.complete({ sent: true });

  // Or fail it (retries depending on retry config)
  // await job.fail("SMTP connection refused");
});
```

### `engine.getDeployedProcesses()`

Returns metadata about all deployed process definitions:

```typescript
const processes = engine.getDeployedProcesses();
// [{ id: "my-process", name: "My Process", version: 1 }]
```

## ProcessInstance

| Property | Type | Description |
|---|---|---|
| `state` | `"running" \| "completed" \| "cancelled"` | Current lifecycle state |
| `activeElements` | `Set<string>` | IDs of currently active elements |
| `variables_snapshot` | `Record<string, unknown>` | Current variable state |
| `beforeComplete` | `(id: string) => Promise<void>` | Override step hook |

| Method | Description |
|---|---|
| `instance.onChange(cb)` | Subscribe to state changes |
| `instance.cancel()` | Cancel the running instance |
| `instance.deliverMessage(name, vars?)` | Correlate a message to a waiting event |

## Variable Scoping

Variables follow hierarchical scope rules:

- Global variables are set at the process level
- Embedded sub-processes create child scopes
- IO mappings move data between scopes on task entry/exit
- `setLocal` writes to the innermost scope only

## Timer Scheduling

Timers use `setTimeout` internally and support ISO 8601 formats:

```
PT30S       → 30 seconds
PT1H30M     → 1.5 hours
P2D         → 2 days
R3/PT1H     → repeat 3 times, every hour
2026-12-01T09:00:00Z  → fire at absolute date
```

Call `parseDurationMs(str)` from `@bpmnkit/engine` to convert duration strings
to milliseconds in your own code.
