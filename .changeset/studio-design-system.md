---
"@bpmnkit/studio": minor
---

Put the studio on the bpmnkit.com design system in full, not just its colours. The token bridge
added in #165 bought the palette, the two type families, square corners and no shadows; the
system's *form* lives in the markup, and the app still read as a generic console in terracotta.

`styles/design-system.css` now carries a `.ds-*` component vocabulary — the hairline-subdivided
grid, the bordered box, the mono label, eyebrow and datum, the tinted state mark, the square
control, the segmented control, the accent-ruled tab, the field, the note, the code block, the
empty state — in Tailwind's `components` layer, so a utility at a call site still overrides it.
Every page is rewritten against it: the dashboard's six metrics are one bordered box divided by
hairlines rather than six cards that lift on hover, status and type readouts are tinted mono
marks rather than filled pills, every list page has a mono eyebrow and a hairline-divided filter,
and Settings reads as five numbered sections. Column heads and the nav rail become mono through
`thead th` and `nav[aria-label="Main navigation"]`, because cascivo ships hashed CSS-module
class names that cannot be selected. Dark and neon now redeclare `--bpmnkit-ds-*` rather than
aliasing it, so a rule reading a design-system token directly themes correctly.

Two pre-existing chrome bugs are fixed with it, both Tailwind's preflight against markup it does
not own: `*{margin:0}` beat the user agent's `dialog{margin:auto}`, so every modal opened against
the top-left corner, and `svg{display:block}` stacked the icon above the label in every cascivo
button.
