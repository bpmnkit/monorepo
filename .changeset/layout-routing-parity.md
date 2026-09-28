---
"@bpmnkit/core": patch
---

Auto-layout no longer draws connections through shapes. Layout output changes; `semanticHash` does not, so per the stability policy this is not a breaking change.

- A final routing pass checks every sequence flow, message flow and association on each plane. A connection that runs through (or along the outline of) a shape it is not related to is re-routed by an obstacle-aware orthogonal search, with bends and crossings charged as extra length. The sequence-flow router uses the same search as its last resort.
- Detour routes dock on the side of each shape that faces the detour. Before, a route whose detour ran between its two ends docked on the far side of one of them and cut across that shape.
- Pools with lanes are framed by the extent of their lanes. Before, the frame took the first (tallest) lane's position and the sum of all lane heights, so a pool whose tallest lane was not its top lane, or whose lanes were nested, was drawn offset from its own content.
- Pool ordering also weighs where each message leaves its pool, so a partner pool goes on the side its messages leave from and message flows cross less of the process.
- Text annotations are packed clear of routed connections, and their association lines avoid crossing them.

On bpmn-auto-layout's 160 test fixtures: connections through other shapes 41 → 0, through their own endpoints 83 → 0, edge crossings 234 → 184. Median runtime is about the same (0.3 ms).
