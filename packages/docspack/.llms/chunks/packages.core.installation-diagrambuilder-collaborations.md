# @bpmnkit/core — Installation — DiagramBuilder — collaborations

`.participant()`, `.message()` and `.messageFlow()` build a pooled diagram. Ids are used
verbatim, so a generated diagram can be referred to by the ids you chose.

```typescript
const defs = Bpmn.createDiagram("Order")
  .process("order", (p) => p.startEvent("o_start").serviceTask("o_send", { taskType: "send" }).endEvent("o_end"))
  .process("supply", (p) => p.startEvent("s_start").serviceTask("s_recv", { taskType: "recv" }).endEvent("s_end"))
  .participant("P_Buyer", { name: "Buyer", processId: "order" })
  .participant("P_Seller", { name: "Seller", processId: "supply" })
  .participant("P_Bank", { name: "Bank" })            // black box — no process
  .message("Msg_Order", { name: "order placed", correlationKey: "= orderId" })
  .messageFlow("MF_1", { source: "o_send", target: "s_recv", messageRef: "Msg_Order" })
  .build();
```

A message flow's `source` and `target` name either participants or flow nodes inside them —
both are valid BPMN, and `applyAutoLayout` reads either.

A diagram with no participants gets **no** collaboration element. An empty
`<bpmn:collaboration/>` is not a neutral addition: a modeler reads it as "this document is
pooled" and renders every process pool-less.

`.collaborationId(id)` renames the collaboration, which defaults to `"Collaboration_1"`.

`build()` refuses a collaboration a modeler would not open, reporting every problem at once:
a participant naming a process the diagram does not contain, two participants claiming the
same process, a duplicate id, a message flow whose endpoint does not exist or which names an
undeclared message, and — the one that is easy to write by accident — a message flow that
starts and ends in the same pool. A message flow is what crosses a pool boundary; one that
stays inside a pool should be a sequence flow.

---
Source: https://bpmnkit.com/docs/packages/core
