# Simulation — Message Correlation

Deliver a message to a waiting `intermediateCatchEvent`:

```typescript
// Process has a catch event waiting for "payment-confirmed"
await instance.deliverMessage("payment-confirmed", {
  paymentMethod: "card",
  confirmedAt: new Date().toISOString(),
});
```


## Step-by-Step Execution

Use the `beforeComplete` hook to pause execution between elements — useful for debugging
and building animated process runners:

```typescript
const instance = engine.start("order", {}, {
  beforeComplete: async (elementId) => {
    console.log("About to complete:", elementId);
    // Inspect state, update UI, etc.
    // Resume by returning from this function
  },
});
```

---
Source: https://docs.bpmnkit.com/guides/simulation/
