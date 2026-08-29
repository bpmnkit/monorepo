# Simulation — Instance State

The `ProcessInstance` object tracks the running state:

```typescript
const instance = engine.start("order");

console.log(instance.state);          // "running" | "completed" | "cancelled"
console.log(instance.activeElements); // Set<string> — currently active element IDs

// Subscribe to state changes
instance.onChange((newState) => {
  console.log("State changed to:", newState);
});
```


## Variables

Variables flow through the process via IO mappings. You can read the current snapshot:

```typescript
const vars = instance.variables_snapshot;
console.log(vars.orderId);       // input variable
console.log(vars.transactionId); // output from a task
```

---
Source: https://bpmnkit.com/docs/guides/simulation
