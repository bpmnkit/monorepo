# Gateways & Branching — Inclusive Gateway (OR)

One or more outgoing paths are taken based on conditions. All active paths converge at the
matching inclusive join:

```typescript
.inclusiveGateway("options")
.branch("express", (b) =>
  b.condition("= expressShipping").serviceTask("fedex", { taskType: "fedex-ship" })
)
.branch("gift-wrap", (b) =>
  b.condition("= giftWrap").serviceTask("wrap", { taskType: "wrap-items" })
)
.branch("standard", (b) =>
  b.defaultFlow().serviceTask("standard-ship", { taskType: "usps-ship" })
)
.inclusiveGateway("join")
.endEvent("end")
```


## Event-Based Gateway

Waits for the _first_ of several events to occur, then takes that path:

```typescript
.eventBasedGateway("wait-for-event")
.branch("payment", (b) =>
  b.intermediateCatchEvent("payment-received", {
    message: { name: "payment-confirmed", correlationKey: "= orderId" },
  })
  .endEvent("paid")
)
.branch("timeout", (b) =>
  b.intermediateCatchEvent("payment-timeout", {
    timer: { timeDuration: "PT24H" },
  })
  .endEvent("cancelled")
)
```

---
Source: https://docs.bpmnkit.com/guides/gateways/
