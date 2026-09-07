# Core Concepts — AI-Compact Format

Raw BPMN XML is verbose — a simple three-node process takes ~60 lines of XML. The compact
format reduces this to a small JSON object that fits in a single LLM prompt:

```typescript
import { compactify, expand } from "@bpmnkit/core";

// Definitions → CompactDiagram (small JSON)
const compact = compactify(definitions);

// CompactDiagram → Definitions (full object)
const restored = expand(compact);
```

The compact format is designed for AI agents:
- Every element has an `id` and a human-readable `name`
- Sequence flows are represented as `{ from, to, condition? }` pairs
- Common Zeebe extensions (task type, headers, form and decision bindings) are inlined
- The full diagram of a typical approval workflow fits in ~500 tokens

> **`compactify()` is a lossy view, not a round trip.** `CompactElement` models about fifteen
> properties, so `expand(compactify(definitions))` is not `definitions`: collaborations,
> participants, message flows, lanes, data stores, artifacts, root-level messages and errors,
> multi-instance loop characteristics, full `zeebe:ioMapping` entries and most diagram
> interchange do not survive it.
>
> Use it to **show** a model to an LLM and to build a **new** model from one. Do not use it as
> an edit path for a file you need to keep — read the file, apply the change to the
> `BpmnDefinitions`, and export that. For the same reason `casen generate bpmn --input`
> refuses to overwrite its input unless you pass `--force`.

---
Source: https://bpmnkit.com/docs/getting-started/concepts
