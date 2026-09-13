---
"@bpmnkit/operate": minor
"@bpmnkit/ui": minor
---

Operate moves onto the bpmnkit.com design system

Operate was the last surface still on the old product palette — a dark neon-purple
shell with rounded cards and filled pills, reached from a site that is flat, square
and hairline-ruled. It now reads as part of the same product.

- **Colour, type and spacing come from the `--bpmnkit-ds-*` tokens** `@bpmnkit/ui`
  owns, the set the landing site, Drop and the editor chrome already read.
- **Dark and the white-label `neon` theme redeclare those tokens on `.op-root`**
  rather than adding a second vocabulary, so every rule — and every shared
  component rendered inside the root — themes itself, and nothing outside Operate
  sees the declaration.
- **The default theme is now `light`**, not `neon`, matching the rest of the
  product. Pass `theme` to keep the old look.
- **The shared components in `@bpmnkit/ui`** (badge, stats card, data table, theme
  switcher) are drawn to the same rules: square, hairline-ruled, no shadow or blur,
  and mono for every label, count and id. Status colour stays semantic, carried by
  the new `--bpmnkit-state-*` pairs, which have a light and a dark value.
