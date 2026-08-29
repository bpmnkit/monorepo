# Gateways & Branching — Nested Branching

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

---
Source: https://bpmnkit.com/docs/guides/gateways
