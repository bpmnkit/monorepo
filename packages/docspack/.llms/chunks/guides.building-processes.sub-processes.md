# Building Processes — Sub-Processes

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

---
Source: https://bpmnkit.com/docs/guides/building-processes
