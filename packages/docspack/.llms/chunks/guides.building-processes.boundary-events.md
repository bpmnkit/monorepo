# Building Processes — Boundary Events

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

---
Source: https://docs.bpmnkit.com/guides/building-processes/
