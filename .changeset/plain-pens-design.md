---
"@bpmnkit/ui": minor
"@bpmnkit/editor": minor
---

Add the bpmnkit.com design system to `@bpmnkit/ui` as an additive `--bpmnkit-ds-*` token set
(flat, square, hairline-ruled, one terracotta accent, Space Grotesk + Space Mono), and move the
editor chrome onto it. Toolbars, the tool palette and the zoom cluster are now one bordered box
with internal hairlines instead of gapped rounded pills; panel labels are mono uppercase; the
input modal, shortcut sheet and properties dock are square and unshadowed; and a selected
element gets a dashed accent halo *around* the shape rather than a recoloured stroke. The
existing `--bpmnkit-*` product palette is unchanged, so nothing that reads it shifts colour.
