# Simulation — Multiple Deployments

The engine supports multiple deployed processes. Use `engine.getDeployedProcesses()` to list them:

```typescript
await engine.deploy({ bpmn: processAXml });
await engine.deploy({ bpmn: processBXml });

const processes = engine.getDeployedProcesses();
// [{ id: "process-a", name: "..." }, { id: "process-b", name: "..." }]
```

---
Source: https://docs.bpmnkit.com/guides/simulation/
