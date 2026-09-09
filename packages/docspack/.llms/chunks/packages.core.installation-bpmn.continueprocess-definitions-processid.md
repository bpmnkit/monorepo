# @bpmnkit/core — Installation — `Bpmn.continueProcess(definitions, processId)`

Continue an existing model instead of generating a replacement for it. `build()` returns *that
document* with the named process's contents replaced, so other processes, the collaboration,
lanes, diagram interchange, root elements and unmodelled content all survive. The input is not
mutated.

```typescript
const updated = Bpmn.continueProcess(Bpmn.parse(xml), "order-process")
  .insertAfter("validate")
  .serviceTask("notify", { name: "Notify", taskType: "notify" })
  .build();
```

Also available as `ProcessBuilder.from(definitions, processId)`.

**`.at(nodeId)`** continues from a node whose path is open — no outgoing sequence flow, or a
gateway, where several outgoing flows are the point. It refuses a node that is not directly in
that process (a node inside a sub-process means building that sub-process), an end event, and a
node that would gain a second outgoing flow — that is an uncontrolled split, and almost always
means you wanted to insert.

**`.insertAfter(nodeId)`** splices what you build next into the path leaving an existing node:
`validate → end` becomes `validate → notify → end`. The existing flow keeps its **id and its
target** and only changes where it starts, so an edge nobody asked to move keeps its identity
in the diagram and in a diff. It refuses a node with no outgoing flow, and one with several,
where "after" is ambiguous.

Which of the two you mean is not guessable, so it is not guessed.

**Continuing never infers gateways.** `ProcessBuilder` normally inserts join gateways for
branches you build; on a parsed model that reads the whole topology and retargets edges you
never touched, so continue mode does not do it. A branch that needs a join here says so with
`.connectTo(joinId)`. `build()` refuses outright if anything would rewire a sequence flow the
document already had.

**Diagram interchange is not regenerated.** Existing shapes keep their positions, and elements
you add have none until `.withAutoLayout()` or a later `applyAutoLayout()` gives them one.

`isExecutable` and the process name are left as they were unless you call `.executable()` or
`.name()`. BPMN reads an absent `isExecutable` as false, so writing the builder's default onto
a process that never carried it would make a non-executable process executable.

---
Source: https://bpmnkit.com/docs/packages/core
