---
"@bpmnkit/core": minor
---

The operations API rejects the wrong document instead of half-running on it

`applyOperations(diagram, ops)` is typed for a `CompactDiagram` and checked
nothing at runtime, so passing raw BPMN XML — the easy mistake, since
`Bpmn.parse()` next door takes exactly that — behaved two different ways
depending on the op list. With operations it threw
`TypeError: diagram.processes is not iterable`, naming a private field rather
than the mistake. With an empty list it returned the input untouched, which
reads as "the pipeline ran and preserved everything" when nothing ran at all —
a preservation test written against it goes green and means nothing.

Both document types are now checked at the boundary of every entry point that
takes one — `applyOperations`, `expand`, `compactify`, `applyBpmnOperations`
and `reconcileCompact` — and a wrong one throws a `TypeError` that names the
function, what arrived, and the way in:

```
applyOperations expects a CompactDiagram, received a string.
Pass compactify(Bpmn.parse(xml)) if you have raw XML.
```

A half-done conversion is named as such: handing `Bpmn.parse(xml)` to
`applyOperations` says `received a BpmnDefinitions. Pass compactify(defs).`,
and handing a compact projection to `applyBpmnOperations` says to pass the
parsed model instead. Well-formed input is unaffected — the check reads
`processes` and, per process, that `elements`/`flows` (or
`flowElements`/`sequenceFlows`) are arrays.
