---
"@bpmnkit/editor": minor
"@bpmnkit/plugins": minor
---

Move every editor panel onto the bpmnkit.com design system: flat (no shadow, gradient or blur),
square, hairline-ruled, one accent, two type roles.

`@bpmnkit/editor` gains `injectChromeStyles()` and a `--bpmnkit-chrome-*` token set, declared
once per theme, that the HUD, the side dock, the modal and every plugin panel now read. The
editor's internal `--hud-*` variables were renamed into it, since they are public surface in a
published package and were never HUD-specific.

`@bpmnkit/plugins` sheds 42 `box-shadow`, 5 `backdrop-filter`, 142 non-circular `border-radius`
and 454 per-theme override selectors across 23 panel stylesheets — the dark/light/neon copies
existed only because there was nowhere to state a panel's ground once. Circular marks, semantic
state (success / warning / danger) and the two document palettes the design brief leaves to
their renderers — the DMN decision table and the FEEL syntax classes — are unchanged.
