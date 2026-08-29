# Core Concepts — Zeebe Extensions

Camunda 8 (Zeebe) uses XML extension elements for its engine-specific config.
The builder exposes these as first-class TypeScript options:

```typescript
.serviceTask("send-email", {
  name: "Send Confirmation Email",
  taskType: "io.camunda.connectors.SMTP.v1",   // connector type
  taskHeaders: {
    from: "noreply@example.com",
    subject: "Your order is confirmed",
  },
  inputMappings: [
    { source: "= orderId", target: "orderId" },
    { source: "= customer.email", target: "to" },
  ],
  outputMappings: [
    { source: "= messageId", target: "emailMessageId" },
  ],
})
```

---
Source: https://bpmnkit.com/docs/getting-started/concepts
