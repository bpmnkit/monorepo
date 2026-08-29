# Core Concepts — Auto-Layout

Call `.withAutoLayout()` before `.build()` to apply the Sugiyama layered graph algorithm.
It produces clean, left-to-right layouts without any coordinate math:

```typescript
const process = Bpmn.createProcess("flow")
  .startEvent("start")
  .serviceTask("work")
  .endEvent("end")
  .withAutoLayout()   // assigns x/y/width/height to all elements
  .build();
```

Under the hood, the layout algorithm:
1. Topologically sorts elements into layers
2. Assigns X coordinates based on layer depth
3. Assigns Y coordinates by crossing-minimisation within each layer
4. Adds waypoints to sequence flow edges

You can access element sizes via the `ELEMENT_SIZES` export if you need to build custom layouts.

---
Source: https://bpmnkit.com/docs/getting-started/concepts
