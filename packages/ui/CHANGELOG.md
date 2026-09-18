# @bpmnkit/ui

## 0.3.0

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

## 0.2.0

### Minor Changes

- 2cdc7f9: Operate moves onto the bpmnkit.com design system

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

### Patch Changes

- 9d412da: Coordinated release of every published package

  `@bpmnkit/core` carries fixes that have been on `main` since the last release but never
  shipped — `compactify()`/`expand()` keeping `<bpmn:documentation>` through the operations
  API (#150) among them, which is still reported as reproducing because the newest artifact
  on npm predates the fix. Bumping every publishable package releases the workspace as one
  set, so no consumer resolves a core that a sibling package was never built against.

  Nothing here changes behaviour beyond what each package's own changesets describe.

## 0.1.0

### Minor Changes

- dc33af9: Add the bpmnkit.com design system to `@bpmnkit/ui` as an additive `--bpmnkit-ds-*` token set
  (flat, square, hairline-ruled, one terracotta accent, Space Grotesk + Space Mono), and move the
  editor chrome onto it. Toolbars, the tool palette and the zoom cluster are now one bordered box
  with internal hairlines instead of gapped rounded pills; panel labels are mono uppercase; the
  input modal, shortcut sheet and properties dock are square and unshadowed; and a selected
  element gets a dashed accent halo _around_ the shape rather than a recoloured stroke. The
  existing `--bpmnkit-*` product palette is unchanged, so nothing that reads it shifts colour.

## 0.0.16

### Patch Changes

- 9cd1942: Improvements around AI integration

## 0.0.15

### Patch Changes

- dcf850a: Improvements
- d6d1860: Several bugfixes and feature implementations

## 0.0.14

### Patch Changes

- [#89](https://github.com/bpmnkit/monorepo/pull/89) [`d576e97`](https://github.com/bpmnkit/monorepo/commit/d576e97736b9056c7e6c8cbac585957dc4cd297c) Thanks [@urbanisierung](https://github.com/urbanisierung)! - docs

## 0.0.13

### Patch Changes

- [#81](https://github.com/bpmnkit/monorepo/pull/81) [`d79affd`](https://github.com/bpmnkit/monorepo/commit/d79affda9b61f5edc400e00b23c54ab037f9ce40) Thanks [@urbanisierung](https://github.com/urbanisierung)! - AI preparation

## 0.0.12

### Patch Changes

- [`802e1dd`](https://github.com/bpmnkit/monorepo/commit/802e1dde53dfda07371e6a83dcf0e05e2650d0a2) Thanks [@urbanisierung](https://github.com/urbanisierung)! - Minor fixes.

## 0.0.11

### Patch Changes

- [#76](https://github.com/bpmnkit/monorepo/pull/76) [`8d1a978`](https://github.com/bpmnkit/monorepo/commit/8d1a978e0b8c321106d95226134cbba6433ab4af) Thanks [@urbanisierung](https://github.com/urbanisierung)! - AI preparation

## 0.0.10

### Patch Changes

- [#74](https://github.com/bpmnkit/monorepo/pull/74) [`e356b98`](https://github.com/bpmnkit/monorepo/commit/e356b98a6b281f825e757cb6e480e50369789d08) Thanks [@urbanisierung](https://github.com/urbanisierung)! - Test suites, simulation mode, improved reebe-wasm

## 0.0.9

### Patch Changes

- [#53](https://github.com/bpmnkit/monorepo/pull/53) [`e9c16e0`](https://github.com/bpmnkit/monorepo/commit/e9c16e0e8f1d786feb10293a8abb2489846402db) Thanks [@urbanisierung](https://github.com/urbanisierung)! - Introduction of CLI plugins, support for more services.

## 0.0.8

### Patch Changes

- [#47](https://github.com/bpmnkit/monorepo/pull/47) [`89e73af`](https://github.com/bpmnkit/monorepo/commit/89e73af16532adb580a338eb8e4996d29b361283) Thanks [@urbanisierung](https://github.com/urbanisierung)! - Design, AI, OpenAPI

## 0.0.7

### Patch Changes

- [#44](https://github.com/bpmnkit/monorepo/pull/44) [`da36cc5`](https://github.com/bpmnkit/monorepo/commit/da36cc54f36abaf0bebd686d4996d516037fd36b) Thanks [@urbanisierung](https://github.com/urbanisierung)! - New logo

## 0.0.6

### Patch Changes

- [#42](https://github.com/bpmnkit/monorepo/pull/42) [`adb60ed`](https://github.com/bpmnkit/monorepo/commit/adb60ed90f675b3565edb7d82d937acce518c837) Thanks [@urbanisierung](https://github.com/urbanisierung)! - Proper README

## 0.0.5

### Patch Changes

- [#39](https://github.com/bpmnkit/monorepo/pull/39) [`0b7e74b`](https://github.com/bpmnkit/monorepo/commit/0b7e74ba66e35ef5361ac35dccf695f4f0671d6a) Thanks [@urbanisierung](https://github.com/urbanisierung)! - Renamed from @bpmn-sdk/_ to @bpmnkit/_. Update your imports.

## 0.0.4

### Patch Changes

- [#34](https://github.com/bpmnkit/monorepo/pull/34) [`a918a93`](https://github.com/bpmnkit/monorepo/commit/a918a93d3d57f69c93c963da1b2710a3467a1b19) Thanks [@urbanisierung](https://github.com/urbanisierung)! - Design changes

## 0.0.3

### Patch Changes

- [#32](https://github.com/bpmnkit/monorepo/pull/32) [`1120205`](https://github.com/bpmnkit/monorepo/commit/11202057baaf25f9a29c9a3a90b1f1f1fc002b64) Thanks [@urbanisierung](https://github.com/urbanisierung)! - Operate and CLI improvements

## 0.0.2

### Patch Changes

- [#30](https://github.com/bpmnkit/monorepo/pull/30) [`42ddd02`](https://github.com/bpmnkit/monorepo/commit/42ddd0255759ce35a14533cbc7667542ba9dac2e) Thanks [@urbanisierung](https://github.com/urbanisierung)! - Operate, CLI, api
