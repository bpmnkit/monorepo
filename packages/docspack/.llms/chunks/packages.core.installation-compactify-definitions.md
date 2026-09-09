# @bpmnkit/core — Installation — `compactify(definitions)`

Projects a `BpmnDefinitions` object onto a `CompactDiagram` — a small JSON object suitable
for LLM prompts. **Lossy:** it keeps topology, names and the common Zeebe bindings, and drops
collaborations, participants, message flows, lanes, data stores, artifacts, root-level
messages and errors, multi-instance loop characteristics, full `zeebe:ioMapping` entries and
diagram interchange.

```typescript
import { compactify } from "@bpmnkit/core";

const compact = compactify(Bpmn.parse(xml));
```

---
Source: https://bpmnkit.com/docs/packages/core
