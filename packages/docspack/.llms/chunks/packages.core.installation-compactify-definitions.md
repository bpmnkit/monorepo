# @bpmnkit/core — Installation — `compactify(definitions)`

Projects a `BpmnDefinitions` object onto a `CompactDiagram` — a small JSON object suitable
for LLM prompts. **Lossy:** it keeps topology, names, `<bpmn:documentation>` and the common
Zeebe bindings, and drops collaborations, participants, message flows, lanes, data stores,
artifacts, root-level messages and errors, multi-instance loop characteristics, full
`zeebe:ioMapping` entries and diagram interchange.

A sequence flow leaving an exclusive, inclusive or complex gateway carries `isDefault: true`
when the gateway names it in `bpmn:default`. It sits on the flow rather than on the gateway
because that is where its alternative, `condition`, sits — a model writing the branches of a
decision marks one of them instead of pointing back at a flow id. `expand` turns it into the
attribute; a flow marked `isDefault` that leaves anything else, or a gateway with two of them,
throws rather than being dropped, because a lost default is a gateway that deadlocks the first
time every condition is false.

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
