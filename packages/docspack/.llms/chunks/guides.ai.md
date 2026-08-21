# AI Integration

BPMN Kit is designed from the ground up to work with AI agents. The compact intermediate
format lets a complete process diagram fit in a single LLM prompt, and the builder API
produces valid BPMN without requiring the AI to write raw XML.


## The Compact Format

Raw BPMN XML is far too verbose for LLMs — a simple three-node process generates ~60 lines.
The compact format represents the same information as a small JSON object:

```typescript
import { Bpmn, compactify, expand } from "@bpmnkit/core";

// Parse some BPMN XML
const definitions = Bpmn.parse(existingXml);

// Convert to compact format
const compact = compactify(definitions);
// compact is ~500 tokens for a typical approval workflow

// Send to your LLM, get back a modified compact object
const modified = await llm.modify(compact, "Add a parallel notification step after approval");

// Convert back to full BPMN
const updatedDefinitions = expand(modified);
const updatedXml = Bpmn.export(updatedDefinitions);
```

---
Source: https://docs.bpmnkit.com/guides/ai/
