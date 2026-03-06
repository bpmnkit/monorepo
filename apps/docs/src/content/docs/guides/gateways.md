---
title: Gateways & Branching
description: Exclusive, parallel, inclusive, and event-based gateways with condition expressions.
---

## Exclusive Gateway (XOR)

Only one outgoing path is taken — the first branch whose condition evaluates to `true`.
One branch should always be the default to handle the fallthrough case:

```typescript
import { Bpmn } from "@bpmn-sdk/core";

const xml = Bpmn.export(
  Bpmn.createProcess("approval-flow")
    .startEvent("start", { name: "Request Submitted" })
    .userTask("review", { name: "Review Request" })
    .exclusiveGateway("approved?", { name: "Approved?" })
    .branch("yes", (b) =>
      b.condition("= approved")
        .serviceTask("notify", { taskType: "send-email", name: "Send Approval" })
        .endEvent("done")
    )
    .branch("no", (b) =>
      b.defaultFlow()
        .endEvent("rejected", { name: "Request Rejected" })
    )
    .withAutoLayout()
    .build()
);
```

### Conditions

Branch conditions are [FEEL expressions](https://docs.camunda.io/docs/components/modeler/feel/):

```typescript
.branch("high-value", (b) =>
  b.condition("= amount > 10000")
    .serviceTask("manual-review", { taskType: "escalate" })
    .endEvent("escalated")
)
```

## Parallel Gateway (AND)

All outgoing paths run concurrently. A matching parallel join gateway waits for all paths
to complete before continuing:

```typescript
const xml = Bpmn.export(
  Bpmn.createProcess("order-fulfillment")
    .startEvent("start")
    .parallelGateway("split")
    .branch("warehouse", (b) =>
      b.serviceTask("pick", { taskType: "warehouse-pick", name: "Pick Items" })
    )
    .branch("payment", (b) =>
      b.serviceTask("charge", { taskType: "payment-charge", name: "Charge Card" })
    )
    .parallelGateway("join")   // waits for all branches
    .serviceTask("ship", { taskType: "shipping", name: "Ship Order" })
    .endEvent("end")
    .withAutoLayout()
    .build()
);
```

## Inclusive Gateway (OR)

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

## Nested Branching

Branches can contain further gateways:

```typescript
.exclusiveGateway("route")
.branch("enterprise", (b) =>
  b.condition("= tier == \"enterprise\"")
    .parallelGateway("enterprise-split")
    .branch("account-mgr", (b2) =>
      b2.userTask("assign-am", { name: "Assign Account Manager" })
    )
    .branch("onboarding", (b2) =>
      b2.serviceTask("kick-off", { taskType: "onboarding-kit" })
    )
    .parallelGateway("enterprise-join")
    .endEvent("enterprise-done")
)
.branch("self-serve", (b) =>
  b.defaultFlow()
    .serviceTask("auto-setup", { taskType: "self-serve-setup" })
    .endEvent("self-serve-done")
)
```
