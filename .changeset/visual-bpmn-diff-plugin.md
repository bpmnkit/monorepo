---
"@bpmnkit/core": minor
"@bpmnkit/plugins": minor
"@bpmnkit/cli": minor
---

Visual BPMN diff — a diagram diff, not a model diff.

`diffDiagram(before, after)` joins `diffSemantics` in `@bpmnkit/core`. The semantic half
excludes diagram interchange by design, so a task somebody dragged reads there as no change at
all; `diffDiagram` adds the layout half back as its own `moved` category, computed from DI
(bounds, waypoints, label placement, and flags such as collapsed/expanded). An element that
both changed and moved is reported as changed. The result covers only elements carrying DI on
one side or the other — a changed `targetNamespace` has nothing to draw — and carries a
per-plane breakdown, since a viewer shows one plane at a time and a change inside a collapsed
sub-process is otherwise invisible.

`@bpmnkit/plugins/diff` renders it: `createBpmnDiff()` returns a pair of canvas plugins, one
per version. Install them on two canvases and every element is marked on the side that can
show it, a legend counts each category and names how many differences sit on a plane the
canvas is not currently showing, and panning or zooming either canvas moves the other.

`casen diff bpmn <before> <after>` reports the same thing in a terminal, naming elements rather
than printing bare ids, with `--format json`, `--ascii`, and `--exit-code` to gate a pipeline.
