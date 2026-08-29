# @bpmnkit/core — Installation — `compactify(definitions)`

Converts a `BpmnDefinitions` object to a `CompactDiagram` — a small JSON object
suitable for LLM prompts.

```typescript
import { compactify } from "@bpmnkit/core";

const compact = compactify(Bpmn.parse(xml));
```

---
Source: https://bpmnkit.com/docs/packages/core
