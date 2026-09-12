---
title: Building Processes
description: Service tasks, user tasks, events, sub-processes, boundary events, multi-process diagrams, and multi-instance patterns.
sidebar:
  order: 1
---

## Service Tasks

A service task represents work done by a system. In Camunda 8 / Zeebe, a job worker picks up
the task and completes it:

```typescript
.serviceTask("charge-card", {
  name: "Charge Credit Card",
  taskType: "payment-charge",       // worker subscribes to this type
  taskHeaders: {
    retries: "3",
  },
  inputMappings: [
    { source: "= amount", target: "chargeAmount" },
    { source: "= card.token", target: "token" },
  ],
  outputMappings: [
    { source: "= transactionId", target: "paymentTransactionId" },
  ],
})
```

## User Tasks

A user task waits for a human actor. Optionally attach a Camunda form:

```typescript
.userTask("review-order", {
  name: "Review Order",
  assignee: "= initiator",           // FEEL expression
  candidateGroups: "approvers",
  formKey: "camunda-forms:bpmn:review-form",
  dueDate: "= now() + duration(\"P2D\")",
})
```

## Events

### Start Events

```typescript
// None start
.startEvent("start")

// Timer start (runs on a schedule)
.startEvent("start-daily", {
  timer: { timeCycle: "R/PT24H" },   // ISO 8601 repeating interval
})

// Message start
.startEvent("start-on-order", {
  message: { name: "order-received", correlationKey: "= orderId" },
})
```

### Intermediate Events

```typescript
// Catch a timer (delay)
.intermediateCatchEvent("wait-1h", {
  timer: { timeDuration: "PT1H" },
})

// Catch a message (wait for external signal)
.intermediateCatchEvent("wait-for-payment", {
  message: { name: "payment-confirmed", correlationKey: "= orderId" },
})

// Throw a message
.intermediateThrowEvent("notify-warehouse", {
  message: { name: "order-ready" },
})
```

### End Events

```typescript
// Normal end
.endEvent("end")

// Error end (triggers error boundary event)
.endEvent("end-error", {
  error: { code: "PAYMENT_FAILED", message: "Payment processing failed" },
})

// Message end
.endEvent("end-notify", {
  message: { name: "process-complete" },
})
```

## Sub-Processes

Embed a child process inline. Sub-processes support the full builder API including
gateways and branching:

```typescript
.subProcess("handle-payment", (sub) =>
  sub
    .startEvent("sub-start")
    .serviceTask("charge", { taskType: "payment-charge" })
    .exclusiveGateway("charge-ok?")
    .branch("success", (b) =>
      b.condition("= success").serviceTask("receipt", { taskType: "send-receipt" }).endEvent("sub-end")
    )
    .branch("failure", (b) =>
      b.defaultFlow().endEvent("sub-failed", { error: { code: "CHARGE_FAILED" } })
    )
)
```

### Event Sub-Processes

An event sub-process starts when a boundary event fires:

```typescript
.eventSubProcess("compensation", {
  triggeredByEvent: true,
  startEvent: {
    interrupting: false,
    error: { code: "PAYMENT_FAILED" },
  },
}, (sub) =>
  sub
    .serviceTask("refund", { taskType: "issue-refund" })
    .endEvent("refunded")
)
```

## Boundary Events

### `.withBoundary()` — recommended

`.withBoundary()` attaches a boundary event to the preceding task, lets you build the
error/timeout path inline, then **automatically restores the cursor to the original task**
so the main flow continues naturally:

```typescript
.serviceTask("charge", { name: "Charge Card", taskType: "payment-charge" })
.withBoundary("on-fail", { errorCode: "PAYMENT_FAILED", cancelActivity: true }, (p) =>
  p
    .serviceTask("notify", { taskType: "send-email" })
    .endEvent("end-failed"),
)
// cursor is back on "charge" — main flow continues here
.serviceTask("fulfill", { name: "Fulfill Order", taskType: "warehouse-pick" })
.endEvent("end-ok")
```

Timer boundaries work the same way:

```typescript
.serviceTask("slow-task", { taskType: "long-job" })
.withBoundary("on-timeout", { timerDuration: "PT30S", cancelActivity: false }, (p) =>
  p.serviceTask("escalate", { taskType: "alert" }).endEvent("escalated"),
)
.serviceTask("next-task", { taskType: "continue" })
```

### `.boundaryEvent()` — lower-level

Use `.boundaryEvent()` directly when you need precise cursor control. It moves the
builder cursor to the boundary event itself:

```typescript
.serviceTask("process-order", { taskType: "order-processor" })
.boundaryEvent("timeout", {
  attachedTo: "process-order",
  cancelActivity: true,
  timer: { timeDuration: "PT30M" },
})
.endEvent("timed-out")
```

## Call Activities

Invoke a separate (reusable) process definition:

```typescript
.callActivity("run-subprocess", {
  name: "Run Fulfillment Sub-Process",
  calledElement: "fulfillment-process",
  propagateAllChildVariables: false,
  inputMappings: [
    { source: "= orderId", target: "orderId" },
  ],
  outputMappings: [
    { source: "= trackingNumber", target: "trackingNumber" },
  ],
})
```

## Multi-Process Diagrams

`Bpmn.createDiagram()` assembles multiple processes into a single definitions document.
This is useful for caller/callee pairs or any workflow that references another process:

```typescript
import { Bpmn } from "@bpmnkit/core";

const defs = Bpmn.createDiagram("OrderSystem")
  .process("order-flow", (p) =>
    p
      .startEvent("start")
      .callActivity("run-payment", { processId: "payment-flow" })
      .endEvent("end"),
  )
  .process("payment-flow", (p) =>
    p
      .startEvent("s")
      .serviceTask("charge", { name: "Charge", taskType: "payment-charge" })
      .endEvent("e"),
  )
  .build();

const xml = Bpmn.export(defs); // both processes in one XML file
```

## Task Defaults

`.defaults()` sets process-wide defaults applied to all subsequent task calls.
Useful when every service task in a process should share the same retry policy:

```typescript
Bpmn.createProcess("my-flow")
  .defaults({ serviceTask: { retries: "5" } })
  .startEvent("s")
  .serviceTask("t1", { name: "Task 1", taskType: "worker-a" })  // retries: "5"
  .serviceTask("t2", { name: "Task 2", taskType: "worker-b" })  // retries: "5"
  .serviceTask("t3", { name: "Task 3", taskType: "worker-c", retries: "1" })  // override
  .endEvent("e")
  .build()
```

## Multi-Instance

Run a task or sub-process once per item in a collection:

```typescript
.serviceTask("notify-all", {
  name: "Notify Each Customer",
  taskType: "send-email",
  multiInstance: {
    parallel: true,                          // false = sequential
    inputCollection: "= customers",
    inputElement: "customer",
    outputCollection: "results",
    outputElement: "= { sent: true, email: customer.email }",
  },
})
```

## Generated IDs

You name every flow node. The builder names everything else, and it derives those names from
the model so that rebuilding an unchanged process produces unchanged BPMN — a diff that shows
only what you actually changed.

A sequence flow is named after the two elements it connects:

```typescript
Bpmn.createProcess("orders")
  .startEvent("start")
  .serviceTask("validate", { taskType: "validate" })
  .endEvent("done")
  .build()
// Flow_start_validate, Flow_validate_done
```

When several flows connect the same pair — the branches of a gateway converging on one join —
each gets a discriminator taken from the branch name, or from its condition when the branch is
unnamed:

```typescript
.exclusiveGateway("gw")
.branch("approved", (b) => b.connectTo("done"))
.branch("rejected", (b) => b.connectTo("done"))
// Flow_gw_gw_join_approved, Flow_gw_gw_join_rejected
```

Because the id comes from the connection rather than from a counter, adding or reordering an
unrelated element leaves the other flows' ids alone. The same is true of root definitions
created from event options — `Message_Order_Received` for `messageName: "Order Received"`, and
likewise `Error_`, `Signal_` and `Escalation_` from the code or name they carry.

Two consequences worth knowing:

- **Ids are only as stable as the elements they name.** Omitting an element id (`.startEvent()`
  with no argument) gets you a generated one that changes on every build, and the flow ids
  around it inherit that. Name the nodes you care about.
- **`defaultFlow` becomes predictable.** Setting a gateway's default by id no longer requires
  knowing a random value: `{ defaultFlow: "Flow_gw_gw_join_rejected" }`. `.branch().defaultFlow()`
  is still the shorter way to say it.

`continueProcess()` never renumbers what the document arrived with: flows the builder did not
create keep their ids, and new ones avoid them.

### Naming a root definition yourself

When the id of a message, error, signal or escalation matters — because a message flow in another
pool, a worker, or a deployed process already refers to it — declare it before the events that
use it:

```typescript
Bpmn.createProcess("orders")
  .message("Msg_OrderReceived", { name: "Order Received" })
  .error("Err_OutOfStock", { code: "OUT_OF_STOCK", name: "Out of stock" })
  .signal("Sig_Cancelled", { name: "Order Cancelled" })
  .escalation("Esc_Review", { code: "NEEDS_REVIEW" })
  .startEvent("start", { messageName: "Order Received" })   // messageRef: Msg_OrderReceived
```

Events still name these by name or code, exactly as before — the declaration only decides the id
they resolve to. Order matters: an event built first declares the definition itself, and
declaring it afterwards under a different id throws rather than leaving two definitions of one
message behind.
