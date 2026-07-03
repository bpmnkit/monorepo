---
"@bpmnkit/core": minor
---

Replaced the Sugiyama/block-tree auto-layout pipeline with a grid-based layout engine.

- **New grid layout engine**: `applyAutoLayout`/`Bpmn.autoLayout()` now place flow nodes on a fixed-cell grid (150×140) instead of layered Sugiyama columns, with a Manhattan-style router for orthogonal edges. Output geometry changes for existing diagrams, but the public API (`Bpmn.autoLayout(xml)`, `applyAutoLayout(defs)`) is unchanged.
- **Message-flow routing** (new capability): `applyAutoLayout` now emits DI for `messageFlow` elements in collaborations, docking on the nearest edge between source/target shapes (flow nodes or pools) with a straight or orthogonal 4-point route.
- **DI completeness checker** (new capability): `checkDiCompleteness(defs)` is now exported — walks a `BpmnDefinitions` tree and reports any flow node, sequence flow, text annotation, association, participant, or message flow missing a corresponding DI shape/edge.
- **Text-annotation packing improvements**: annotations are now packed above/below the content bounding box with overlap and crossing avoidance, replacing the previous local-bounds heuristic.
- **Export removals**: `buildBlockTree`, `applyBlockLayout`, `routeEdgeAstar`, and `assignGridRows` are no longer exported from `@bpmnkit/core` — they were internals of the removed Sugiyama/block-tree pipeline with no external replacement (the grid engine's equivalents are not part of the public API).
