# Gateways & Branching — Exclusive Gateway (XOR)

Only one outgoing path is taken — the first branch whose condition evaluates to `true`.
One branch should always be the default to handle the fallthrough case:

```typescript
import { Bpmn } from "@bpmnkit/core";

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

---
Source: https://bpmnkit.com/docs/guides/gateways
