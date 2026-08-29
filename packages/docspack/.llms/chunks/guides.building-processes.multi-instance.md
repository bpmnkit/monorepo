# Building Processes — Multi-Instance

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

---
Source: https://bpmnkit.com/docs/guides/building-processes
