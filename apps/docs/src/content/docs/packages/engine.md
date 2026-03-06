---
title: "@bpmn-sdk/engine"
description: Zero-dependency BPMN simulation engine for browsers and Node.js.
---

## Overview

`@bpmn-sdk/engine` is a lightweight BPMN 2.0 process engine that runs entirely in the
JavaScript runtime — no external services required.

**Supported BPMN elements:**
- Service tasks, user tasks, script tasks, manual tasks
- Exclusive, parallel, inclusive, and event-based gateways
- Timer events (ISO 8601 duration, date, and cycle)
- Message correlation (intermediate catch events, message start)
- DMN decision evaluation (requires `@bpmn-sdk/core`)
- Boundary events (timer, error, message)
- Call activities (inline subprocess invocation)
- IO variable mappings (Zeebe `zeebe:ioMapping` extension)

Zero runtime dependencies. ESM-only.

## Installation

```sh
pnpm add @bpmn-sdk/engine
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
- Sub-processes and call activities create child scopes
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

Call `parseDurationMs(str)` from `@bpmn-sdk/engine` to convert duration strings
to milliseconds in your own code.
