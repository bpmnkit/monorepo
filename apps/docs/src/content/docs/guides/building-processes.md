---
title: Building Processes
description: Service tasks, user tasks, events, sub-processes, markers, and multi-instance patterns.
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

Embed a child process inline:

```typescript
.subProcess("handle-payment", (sub) =>
  sub
    .startEvent("sub-start")
    .serviceTask("charge", { taskType: "payment-charge" })
    .serviceTask("receipt", { taskType: "send-receipt" })
    .endEvent("sub-end")
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

Attach boundary events to tasks to handle timeouts, errors, and escalations:

```typescript
.serviceTask("process-order", { taskType: "order-processor" })
  .boundaryEvent("timeout", {
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
