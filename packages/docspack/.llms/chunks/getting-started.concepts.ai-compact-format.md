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
- Zeebe extensions (task type, IO mappings, headers) are inlined
- The full diagram of a typical approval workflow fits in ~500 tokens

---
Source: https://docs.bpmnkit.com/getting-started/concepts/
