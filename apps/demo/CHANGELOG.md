# @bpmnkit/demo

## 0.1.1

### Patch Changes

- Updated dependencies [0ba6ef6]
- Updated dependencies [d910fae]
- Updated dependencies [0ba6ef6]
  - @bpmnkit/canvas@1.0.0
  - @bpmnkit/core@1.0.0

## 0.1.0

### Minor Changes

- f0a0ea2: Move the rest of the repo onto the bpmnkit.com design system.

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

### Patch Changes

- Updated dependencies [191d4d2]
- Updated dependencies [f0a0ea2]
  - @bpmnkit/core@0.8.0
  - @bpmnkit/ui@0.3.0
  - @bpmnkit/canvas@0.2.5

## 0.0.12

### Patch Changes

- Updated dependencies [c8ceaaa]
  - @bpmnkit/core@0.7.1
  - @bpmnkit/canvas@0.2.4

## 0.0.11

### Patch Changes

- Updated dependencies [e096585]
  - @bpmnkit/core@0.7.0
  - @bpmnkit/canvas@0.2.3

## 0.0.10

### Patch Changes

- Updated dependencies [780e39d]
  - @bpmnkit/core@0.6.0
  - @bpmnkit/canvas@0.2.2

## 0.0.9

### Patch Changes

- Updated dependencies [53a9e25]
- Updated dependencies [9d412da]
- Updated dependencies [2cdc7f9]
- Updated dependencies [9d412da]
  - @bpmnkit/core@0.5.0
  - @bpmnkit/ui@0.2.0
  - @bpmnkit/canvas@0.2.1

## 0.0.8

### Patch Changes

- Updated dependencies [8fdc6d4]
- Updated dependencies [e4c16a9]
- Updated dependencies [e4c16a9]
  - @bpmnkit/core@0.4.0
  - @bpmnkit/canvas@0.2.0

## 0.0.7

### Patch Changes

- Updated dependencies [dc33af9]
  - @bpmnkit/ui@0.1.0

## 0.0.6

### Patch Changes

- Updated dependencies [1d2ec66]
- Updated dependencies [1d2ec66]
- Updated dependencies [1d2ec66]
- Updated dependencies [1d2ec66]
- Updated dependencies [1d2ec66]
  - @bpmnkit/core@0.3.0
  - @bpmnkit/canvas@0.1.0

## 0.0.5

### Patch Changes

- Updated dependencies [00a65f5]
  - @bpmnkit/core@0.2.0
  - @bpmnkit/canvas@0.0.31

## 0.0.4

### Patch Changes

- Updated dependencies [9cd1942]
  - @bpmnkit/canvas@0.0.30
  - @bpmnkit/core@0.1.2
  - @bpmnkit/ui@0.0.16

## 0.0.3

### Patch Changes

- Updated dependencies [c8f04ae]
  - @bpmnkit/canvas@0.0.29
  - @bpmnkit/core@0.1.1

## 0.0.2

### Patch Changes

- Updated dependencies [b90111f]
- Updated dependencies [b90111f]
  - @bpmnkit/core@0.1.0
  - @bpmnkit/canvas@0.0.28
