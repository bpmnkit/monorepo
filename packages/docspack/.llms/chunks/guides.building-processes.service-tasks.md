# Building Processes — Service Tasks

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

---
Source: https://bpmnkit.com/docs/guides/building-processes
