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
- Exclusive (with default flow), parallel, inclusive and event-based gateways. An event-based
  gateway arms the message, timer and signal catch events (and receive tasks) after it; the
  first to fire takes its branch and the others are cancelled. A complex gateway splits like
  an inclusive one: every flow whose condition holds, else the default flow
- Start events: none, and signal (see `broadcastSignal`). End events: none, terminate, error,
  escalation, signal and compensation
- Intermediate catch events: timer (ISO 8601 duration, date and cycle), message, signal and
  link. Intermediate throw events: signal, escalation, link and compensation
- Boundary events: timer, message and signal — interrupting, or non-interrupting, in which
  case the activity keeps running and a timer cycle fires once per repetition — plus error and
  escalation. An error a job worker throws with `job.throwError(code, …)` is caught like one
  from an error end event
- Errors and escalations propagate outwards: a boundary event on the throwing task, then per
  scope an event sub-process of the scope and a boundary event on the activity running it, up
  to the call activity that started the instance. An uncaught error fails the instance; an
  uncaught escalation does not
- Embedded sub-processes, transactions and event sub-processes (message, timer, signal, error
  and escalation start events, interrupting or not), in the process or in a sub-process
- Call activities: when `zeebe:calledElement processId` names a process deployed in the same
  engine, it runs as a child instance. By default every parent variable is copied in and every
  child variable propagates back (`propagateAllParentVariables` / `propagateAllChildVariables`
  turn that off); output mappings pick what returns. A failed job in the child fails the
  caller. A process that is not deployed completes the call activity with an `element:warning`
  event
- Multi-instance tasks and sub-processes, parallel and sequential: `zeebe:loopCharacteristics`
  `inputCollection` / `inputElement` / `outputCollection` / `outputElement`, `loopCardinality`,
  and `completionCondition` with `numberOfInstances`, `numberOfActiveInstances`,
  `numberOfCompletedInstances` and `numberOfTerminatedInstances`. Each iteration has its own
  scope with `loopCounter`
- Compensation: a compensation throw or end event runs the handlers (`isForCompensation`
  activities associated with a compensation boundary event) of the activities completed in
  its scope, including inside completed sub-processes, one after another in reverse
  completion order, and waits for them. `activityRef` limits it to one activity
- Zeebe IO mappings, and DMN decisions through `@bpmnkit/feel`

**What it does not execute.** Ad-hoc sub-processes without a task definition complete without
running their inner activities. Conditional events are not evaluated: a conditional catch
event passes straight through, and conditional boundary and start events never fire. A message
start event of a top-level process does not start instances, and transaction cancel events
are not modelled. Inclusive and complex *joins* do not wait for the other branches — each
arriving token passes through — and a complex gateway's activation condition is ignored.
Zeebe invokes compensation handlers all at once rather than in reverse order, and supports
compensation event sub-processes, which the simulator does not. In `beforeComplete` (step)
mode, timers on catch events and event-based gateways fire without waiting; boundary and
event sub-process timers keep real time. For Zeebe semantics, `@bpmnkit/engine/wasm-runner`
runs the same scenarios on the Reebe engine compiled to WebAssembly (experimental).

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

### `engine.broadcastSignal(name, variables?)`

Delivers a signal to every running instance of this engine, call-activity children included,
and starts an instance of every deployed process whose top-level signal start event matches.
`name` matches the signal's `name`, or its id when it has none. Returns the instances it
started. A signal throw or end event inside an instance broadcasts the same way.

```typescript
engine.broadcastSignal("shutdown", { reason: "maintenance" });
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
| `state` | `"active" \| "completed" \| "terminated" \| "failed"` | Current lifecycle state |
| `activeElements` | `string[]` | IDs of currently active elements |
| `variables_snapshot` | `Record<string, unknown>` | Current variable state |
| `beforeComplete` | `(id: string) => Promise<void>` | Override step hook |

| Method | Description |
|---|---|
| `instance.onChange(cb)` | Subscribe to state changes |
| `instance.cancel()` | Cancel the running instance |
| `instance.deliverMessage(name, vars?, correlationKey?)` | Correlate a message to the oldest waiting subscription — catch event, boundary event, event-based gateway branch or event sub-process. `name` matches the message's name or id. With a `correlationKey`, only a subscription whose `zeebe:subscription` correlation key (on the event or its message, evaluated when the subscription opened) equals it matches. Falls through to running call-activity children. Returns whether anything received it |
| `instance.deliverSignal(name, vars?)` | Deliver a signal to this instance only |

Besides `element:entering` / `entered` / `leaving` / `left`, `variable:set`, `job:created`,
`feel:evaluated` and the `process:*` events, `onChange` reports `element:terminated` when an
interrupting event, a terminate end event or a multi-instance completion condition cancels
an element, and `element:warning` when the simulator skips something it cannot run.

## Variable Scoping

Variables follow Zeebe's scope rules:

- The process, each embedded or event sub-process, each multi-instance iteration and each
  element with an IO mapping has its own scope
- Input mappings create local variables of the element
- A result — job variables, a script or decision result, a message or signal payload, a child
  process's variables — updates the variable in the nearest scope that defines it, or creates
  it in the process scope. With output mappings, the result stays local to the element and
  only the mapped variables leave it
- A sub-process's local variables are dropped when it completes unless an output mapping
  carries them out
- `inputElement` and `loopCounter` are local to a multi-instance iteration; the
  `outputCollection` reaches the enclosing scope when the loop completes

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
