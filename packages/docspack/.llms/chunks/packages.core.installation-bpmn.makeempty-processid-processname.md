# @bpmnkit/core — Installation — `Bpmn.makeEmpty(processId?, processName?)`

Returns minimal BPMN 2.0 XML — one process with one start event.

```typescript
const xml = Bpmn.makeEmpty("my-process", "My Process");
// Returns an XML string (not a BpmnDefinitions object)
```

---
Source: https://docs.bpmnkit.com/packages/core/
