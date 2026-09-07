# AI Integration

BPMN Kit is designed from the ground up to work with AI agents. The compact intermediate
format lets a complete process diagram fit in a single LLM prompt, and the builder API
produces valid BPMN without requiring the AI to write raw XML.


## The Compact Format

Raw BPMN XML is far too verbose for LLMs — a simple three-node process generates ~60 lines.
The compact format carries the topology and the common Zeebe bindings as a small JSON object:

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

> **`expand()` does not restore what `compactify()` left behind.** `CompactElement` models
> about fifteen properties; collaborations, participants, message flows, lanes, data stores,
> artifacts, root-level messages and errors, multi-instance loop characteristics, full
> `zeebe:ioMapping` entries and most diagram interchange are not among them.
>
> The loop above is safe for a model **you generated** from a compact definition. Running it
> over a file authored elsewhere — a Camunda blueprint, anything touched in Web Modeler —
> will silently strip those parts.
>
> **Use `reconcileCompact` instead when editing an existing file.** It applies the same compact
> input as changes rather than expanding it over the model, so what the compact form cannot
> describe survives:
>
> ```typescript
> import { reconcileCompact } from "@bpmnkit/core";
>
> const { definitions } = reconcileCompact(Bpmn.parse(existingXml), modified);
> const updatedXml = Bpmn.export(definitions);
> ```
>
> If the model returns edit operations rather than a whole diagram, `applyBpmnOperations` takes
> them directly against the full model.

---
Source: https://bpmnkit.com/docs/guides/ai
