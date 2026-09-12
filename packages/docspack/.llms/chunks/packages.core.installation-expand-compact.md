# @bpmnkit/core — Installation — `expand(compact)`

Builds a `BpmnDefinitions` object from a `CompactDiagram`. It restores only what the compact
form carries, so `expand(compactify(definitions))` is not `definitions` — use this to build a
model from a compact definition, not as a round trip for a file you need to keep.

```typescript
import { expand } from "@bpmnkit/core";

const definitions = expand(compactDiagram);
const xml = Bpmn.export(definitions);
```

Every element type the model knows expands to itself, data elements included. The switch is
exhaustive, so a new `BpmnElementType` fails the build here rather than silently arriving as a
`task` — which is how `dataObject`, `dataObjectReference` and `dataStoreReference` were lost.

---
Source: https://bpmnkit.com/docs/packages/core
