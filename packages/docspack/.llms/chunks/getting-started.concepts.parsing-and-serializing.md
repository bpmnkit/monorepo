# Core Concepts — Parsing and Serializing

The SDK can round-trip any BPMN 2.0 XML — parse it, modify it in TypeScript, and export it back:

```typescript
import { Bpmn } from "@bpmnkit/core";

// Parse XML into a typed object
const definitions = Bpmn.parse(xmlString);

// Access the first process
const process = definitions.rootElements.find(
  (el) => el.$type === "bpmn:Process"
);

// Export back to XML
const newXml = Bpmn.export(definitions);
```

### Round-trip fidelity

The parser preserves all attributes, extensions, and vendor-specific elements. Exporting the
parsed object produces XML that is semantically equivalent to the input.

---
Source: https://bpmnkit.com/docs/getting-started/concepts
