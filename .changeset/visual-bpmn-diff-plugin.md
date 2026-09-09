---
"@bpmnkit/plugins": minor
---

New `@bpmnkit/plugins/diff` subpath — a side-by-side visual BPMN diff.

`createBpmnDiff()` returns a pair of canvas plugins, one per version. Install them on two
canvases and every element that was added, removed, changed or moved is marked on the side
that can show it, a legend counts each category, and panning or zooming either canvas moves
the other.

The semantic half comes from `diffSemantics` in `@bpmnkit/core`, which excludes diagram
interchange by design — so a pure layout change reads there as no change at all. The plugin
adds that half back as its own `moved` category, which is what separates a *diagram* diff
from a model diff. An element that both changed and moved is reported as changed.

`computeBpmnDiff(before, after)` is exported on its own for callers that want the element
ids without a canvas. Its result covers only elements carrying diagram interchange on one
side or the other, so the counts match what is actually drawn.
