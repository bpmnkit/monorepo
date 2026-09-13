# @bpmnkit/core — Installation — `compactify(definitions)`

Projects a `BpmnDefinitions` object onto a `CompactDiagram` — a small JSON object suitable
for LLM prompts. **Lossy:** it keeps topology, names, `<bpmn:documentation>` and the common
Zeebe bindings, and drops collaborations, participants, message flows, lanes, data stores,
artifacts, root-level messages and errors, multi-instance loop characteristics, full
`zeebe:ioMapping` entries and diagram interchange.

`documentation` is carried on every element and on the process itself, because in Camunda 8 it
is not decoration: on an ad-hoc sub-process child it is the tool description handed to the LLM,
and on a start event it is where the process input contract is written. It had been dropped, so
a single `rename` operation cost a file the documentation of every element in it.

```typescript
import { compactify } from "@bpmnkit/core";

const compact = compactify(Bpmn.parse(xml));
```

---
Source: https://bpmnkit.com/docs/packages/core
