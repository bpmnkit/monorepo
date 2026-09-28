# Core Concepts — Parsing and Serializing

Parse BPMN 2.0 XML into a typed object, modify it in TypeScript, and export it back:

```typescript
import { Bpmn, findProcess } from "@bpmnkit/core";

// Parse XML into a typed object
const definitions = Bpmn.parse(xmlString);

// Access the first process, or look one up by id
const process = definitions.processes[0];
const approval = findProcess(definitions, "approval-flow");

// Export back to XML
const newXml = Bpmn.export(definitions);
```

---
Source: https://bpmnkit.com/docs/getting-started/concepts
