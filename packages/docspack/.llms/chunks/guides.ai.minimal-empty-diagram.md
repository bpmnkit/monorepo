# AI Integration — Minimal Empty Diagram

When an AI agent needs to start fresh, use `Bpmn.makeEmpty()` to get a valid starting point
with a single start event:

```typescript
import { Bpmn } from "@bpmnkit/core";

// Returns a valid BPMN XML string — one start event, ready for an agent to extend
const xml = Bpmn.makeEmpty("my-process", "My Process");
```


## Prompting Strategy

For best results, give the LLM the compact diagram and a clear instruction. A good system
prompt excerpt:

```
You are a BPMN process designer. The user will describe a business process and you will
return a CompactDiagram JSON object.

Rules:
- Use camelCase IDs
- Every service task needs a taskType string (the Zeebe worker subscription)
- Use FEEL expressions for gateway conditions (start with "= ")
- Always include a start event and at least one end event
- Do not add fields that are not part of the CompactDiagram schema
```

---
Source: https://docs.bpmnkit.com/guides/ai/
