---
"@bpmnkit/astro-shared": minor
"@bpmnkit/ui": minor
"@bpmnkit/plugins": minor
"@bpmnkit/user-tasks": minor
"@bpmnkit/canvas": patch
"@bpmnkit/learn": minor
"@bpmnkit/demo": minor
---

Move the rest of the repo onto the bpmnkit.com design system.

`apps/learn` — a deployed sibling of bpmnkit.com — was still wearing the 2025 aurora: three
blurred gradient orbs drifting on a loop, a masked dot grid, a fractal-noise grain layer,
gradient-clipped headings, glow overlays, 8–20px radii, `translateY` lifts, pill badges and a
magenta third brand colour. It is now the same flat, square, hairline-ruled system, with the
catalogue and the glossary as one bordered box subdivided by hairlines and the embedded editor on
the system's light theme rather than the `neon` white-label one.

`@bpmnkit/astro-shared` carries that: it exposes the landing site's own token vocabulary with the
landing site's own values, derived from `--bpmnkit-ds-*`, so both sites read one set.
`background.css` is now one rule — the ground — and the aurora's classes are deliberately no
longer defined. `--bpmnkit-ds-bg-alt` and `--bpmnkit-ds-accent-tint` are new in `@bpmnkit/ui`, so
the two values the landing had hardcoded are shared rather than duplicated.

In `@bpmnkit/plugins`, `form-viewer`, `form-editor` and `dmn-viewer` stop restating palettes of
their own — a Catppuccin dark and a Tailwind light, beside a system font stack — and read the
design-system set with hex fallbacks, so they still theme when mounted outside the editor. 31
non-zero radii are gone; the DMN input/output tints and the FEEL syntax colours stay exempt.
`variable-flow`'s "both" mark is mixed from the two states it means in place of the product
palette's secondary brand colour.

`apps/demo` opened in the `neon` white-label theme on the product palette and was still titled
"BPMN SDK". It now wears the system through the same one-seam token bridge the studio uses, so the
760 lines of inline `var(--bpmnkit-*)` markup did not have to move; its three comparison variants
keep their semantic success / warn / danger colours, which is what they mean.

`@bpmnkit/user-tasks` is square, hairline-ruled and mono in its meta line, and defaults to `light`
rather than `neon` — it mounts inside the studio's task page, which is already on the system. In
`@bpmnkit/canvas` the keyboard focus ring takes the accent in place of a hardcoded `#0066cc`; the
renderer's strokes, fills and labels are untouched.
