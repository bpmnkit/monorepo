# Building Processes — Task Defaults

`.defaults()` sets process-wide defaults applied to all subsequent task calls.
Useful when every service task in a process should share the same retry policy:

```typescript
Bpmn.createProcess("my-flow")
  .defaults({ serviceTask: { retries: "5" } })
  .startEvent("s")
  .serviceTask("t1", { name: "Task 1", taskType: "worker-a" })  // retries: "5"
  .serviceTask("t2", { name: "Task 2", taskType: "worker-b" })  // retries: "5"
  .serviceTask("t3", { name: "Task 3", taskType: "worker-c", retries: "1" })  // override
  .endEvent("e")
  .build()
```

---
Source: https://bpmnkit.com/docs/guides/building-processes
