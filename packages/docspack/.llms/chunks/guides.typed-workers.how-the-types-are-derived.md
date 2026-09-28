# Typed Workers — How the types are derived

FEEL cannot be typed statically, so every value is `unknown`. But the keys are exact, and a key is
optional when the model does not guarantee it.

| What | Rule |
|---|---|
| Job types | Every element with a static `zeebe:taskDefinition` type: service, send, script and business rule tasks, message throw events, and ad-hoc sub-processes (AI Agent job workers). User tasks are excluded. A job type written as a FEEL expression (`=…`) is skipped and listed in the file header. |
| Variables | The targets of the element's `zeebe:input` mappings, all required. If the element has no input mappings, the variables in scope on its incoming flows, from the variable-flow analysis, all optional. |
| Output | The variables that the element's `zeebe:output` sources read, less the element's own input targets. A key is required when the source is a plain reference such as `=total`, and optional otherwise. If the element has no output mappings, the output is the variables that downstream elements read and that nothing else in the process sets, all optional. |
| Headers | The `zeebe:taskHeaders` of the element, with their values as literal types. |
| Errors | The error codes that error boundary events catch on the element and on its enclosing sub-processes, and the codes that error event sub-processes catch in those scopes. A catch-all error event makes the type `string`. If nothing catches an error, the type is `never`, because an uncaught error raises an incident. |
| Shared job types | When two or more elements use the same job type, their contracts are merged. A key is required only when all of the elements require it. |
| Processes | Only executable processes (`isExecutable="true"`) are read. |

The output is deterministic: everything is sorted. Two job types that give the same TypeScript name,
for example `ship-order` and `ship_order`, get a numeric suffix (`ShipOrder`, `ShipOrder2`).

To generate the types from code, use the same function that the CLI uses:

```ts
import { Bpmn, generateProcessTypes, extractProcessContract } from "@bpmnkit/core"

const source = generateProcessTypes([Bpmn.parse(orderXml), Bpmn.parse(returnsXml)])
const contract = extractProcessContract(Bpmn.parse(orderXml))   // the same data as objects
```

---
Source: https://bpmnkit.com/docs/guides/typed-workers
