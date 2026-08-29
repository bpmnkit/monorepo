# @bpmnkit/api — Incident Resolution

```typescript
// Find all incidents for a process instance
const { items: incidents } = await client.incidents.list({
  processInstanceKey: instance.processInstanceKey,
});

// Fix the problem in your code, then resolve
for (const incident of incidents) {
  await client.incidents.resolve({ incidentKey: incident.key });
}
```


## Message Correlation

```typescript
await client.messages.publish({
  messageName: "payment-confirmed",
  correlationKey: "ord-456",
  variables: {
    paymentMethod: "card",
    confirmedAt: new Date().toISOString(),
  },
  timeToLive: 60_000,   // ms — how long to wait for a matching instance
});
```

---
Source: https://bpmnkit.com/docs/packages/api
