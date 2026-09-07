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

### Round-trip fidelity

`BpmnDefinitions` is a hand-written TypeScript model of BPMN, not a complete one. It carries
the elements and attributes the SDK models, plus `extensionElements` and `unknownAttributes`
on the types that declare them — everything else is dropped on export. Know what survives
before you round-trip a file you cannot regenerate.

**Preserved:** flow nodes, sequence flows, gateways, sub-processes and boundary events;
their `extensionElements` (so all Zeebe task configuration — job type, IO mappings, headers,
form and decision bindings) and their `documentation`; process- and flow-level
`extensionElements`; collaborations, participants, message flows and lanes as structure;
namespace declarations; and diagram interchange, including `bioc`/`color` extensions.

**Dropped today:**

- `extensionElements` on root-level `bpmn:message`, `bpmn:error`, `bpmn:escalation` and
  `bpmn:signal` — which means **`zeebe:subscription` correlation keys do not survive**. A
  round-tripped model still deploys and still opens in a modeler, but no longer correlates
  messages.
- `extensionElements` on participants, message flows, lanes and artifacts.
- `bpmn:documentation` on `bpmn:process` and `bpmn:definitions`.
- `bpmn:category` and `bpmn:categoryValue` (group labels).
- `bpmn:dataInputAssociation`, `bpmn:dataOutputAssociation` and `bpmn:property` — the data
  wiring between tasks and data objects.
- Anything else the parser does not model, including `bpmn:ioSpecification`,
  `bpmn:correlationKey`, `bpmn:itemDefinition`, `bpmn:import` and `bpmn:resourceRole`.

Closing these gaps and gating them with a fidelity test over a corpus of real Camunda
models is tracked as *Core Model Fidelity* on the roadmap. Until that lands, treat
`Bpmn.parse()` → `Bpmn.export()` over a file you did not generate as lossy: write to a new
path and diff, rather than replacing the original.

---
Source: https://bpmnkit.com/docs/getting-started/concepts
