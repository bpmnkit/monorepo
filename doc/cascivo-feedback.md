# Cascivo — Integration Feedback

Findings from integrating `@cascivo/react` into the bpmnkit studio (a Preact +
Vite + Tailwind v4 app). Everything below is firsthand: to integrate I had to
reverse-engineer the packages from the published npm tarballs and their type
definitions, because I couldn't find the equivalent information in docs.

Versions evaluated: `@cascivo/react@0.2.1`, `@cascivo/themes@0.2.2`,
`@cascivo/tokens@0.2.0`, `@cascivo/core@0.1.1`, `@cascivo/i18n@0.1.1`,
`@cascivo/icons@0.1.0`.

Priorities: **P1** blocks/surprises integrators · **P2** real friction · **P3**
polish.

---

## Documentation gaps

### P1 — There's no reachable API/usage reference for `@cascivo/react`
I had to read `dist/index.d.ts` to discover component names and props. There are
165 exported components and almost none are usable without opening the `.d.ts`
(e.g. `AppShell`, `SideNav`, `ShellHeader`, `DataTable`, `CommandMenu` all have
non-obvious prop shapes). A per-component reference with one runnable example
each is the single highest-value thing missing.

### P1 — "Package vs CLI" decision isn't documented
It's not stated anywhere obvious whether to consume cascivo via the
`npx cascivo add` copy-in CLI or the `@cascivo/react` package, nor the
trade-offs (update story, bundle size, customization). I had to infer that both
exist and pick.

### P1 — Theming / custom-brand recipe is undocumented
The token system is the whole value proposition but the only way I learned it
was grepping the theme CSS. Specifically missing:
- The list of semantic tokens and what each drives.
- How `data-theme` selection works and how to author a **custom** theme.
- The cascade/layer rules — I had to discover empirically that themes live in
  `@layer cascivo.theme`, so an **unlayered** `:root` override wins. That's the
  exact knowledge an integrator needs to map cascivo onto an existing brand, and
  it's nowhere.
- There's no documented way to bridge cascivo to an external token set; I ended
  up hand-mapping ~60 `--cascivo-color-*` tokens.

### P2 — No framework-compat / SSR notes
Nothing states which frameworks are supported. It's signals-based with React
peers — does it work in Next RSC? Astro islands? Preact? (It does work under a
`react → preact/compat` alias — I verified — but a reader can't know that.)
Document the supported matrix and the Preact story explicitly.

### P2 — No browser-support / build-tooling baseline
The CSS relies on `@layer`, `@container`, `:has()`, `oklch()`, and draft CSS
`@function`. Integrators need a stated minimum target and a note about minifier
compatibility (see the lightningcss issue below).

### P2 — No package compatibility matrix
Six packages at four different 0.x versions with peer ranges between them. A
"these versions go together" table would prevent mismatched installs.

### P3 — Discoverability of the CSS entry
The export key is `./styles.css` but the file on disk is `dist/cascivo.css`. Not
wrong, but a copy-paste import line in the README would save a lookup.

---

## Technical issues

### P1 — `@cascivo/tokens` emits an invalid `@import` order
Importing `@cascivo/tokens` (directly or transitively via `@cascivo/themes`)
produces:
```
[vite:css][postcss] @import must precede all other statements
(besides @charset or empty @layer)
```
The token CSS places an `@import` after a non-empty `@layer`. It still compiles,
but it's a per-build warning for every consumer and a spec violation. Move the
internal `@import` to the top of the file.

### P1 — `@cascivo/tokens/functions.css` breaks under lightningcss (Tailwind v4)
Building through Tailwind v4's lightningcss minifier:
```
[lightningcss minify] Unknown at rule: @function
  ...@layer cascivo.functions{@function --cascivo-step(--n <number>, ...
```
CSS `@function` is a 2024+ draft feature that current minifiers (lightningcss,
and others) don't parse, so `--cascivo-step` / `--cascivo-scale` get **dropped**
silently. Any token derived from them won't resolve in those pipelines.
Recommend shipping precomputed static fallbacks alongside the `@function`
definitions, or gating `@function` behind an opt-in build.

### P2 — React peer deps are heavy for a signals-based, Preact-friendly library
`@cascivo/react` requires `react`/`react-dom >= 18` as peers, so a Preact app
must install `react@19` purely to satisfy the peer (the actual bundle uses the
`react → preact/compat` alias). Consider `peerDependenciesMeta` /
`peerDependencies` ranges that acknowledge Preact, or document the alias setup so
people don't think it's unsupported.

### P2 — No per-component subpath exports
`@cascivo/react` exports only `.` and `./styles.css`. There's no
`@cascivo/react/button` style subpath and the CSS is a single ~250 KB file
(`dist/cascivo.css`), so consumers pull the whole component surface and all
styles regardless of what they use. Subpath exports + per-component CSS (or
documented sideEffects/tree-shaking guarantees) would help bundle size.

### P3 — `./package.json` isn't exported
`require('@cascivo/react/package.json')` throws `ERR_PACKAGE_PATH_NOT_EXPORTED`.
Some tooling reads it; adding `"./package.json": "./package.json"` to `exports`
is the conventional fix.

### P1 — `Menu` can't replace a Radix-style dropdown menu
`Menu` is currently `Menu` + `MenuTrigger` + `MenuItem{children, onSelect,
disabled}` + `MenuSeparator`. Migrating three real studio dropdowns (cluster
picker, project picker, model actions) off Radix was blocked by missing pieces:
- **No `MenuLabel` / section header** — these menus group items under labels
  ("Profiles", "Projects"); there's no non-interactive label item.
- **No `asChild` on `MenuTrigger`** — the triggers are bespoke styled controls
  (status dot + truncated text + caret). `MenuTrigger` wraps its children in its
  own button, forcing nested/duplicated trigger chrome.
- **No `asChild` (or `href`) on `MenuItem`** — several items are router links
  ("Add profile →"). Workable via `onSelect: () => navigate(...)`, but loses
  real anchor semantics (middle-click / open-in-new-tab).
- **No checkbox / radio items** — needed for selection-state menus.

`MenuButton` (label + `items[]`) is even more constrained (flat array, no custom
trigger). Net: a Radix `DropdownMenu` consumer can't migrate without losing
features. Consider adding `MenuLabel`, `asChild` on trigger/items, and
checkbox/radio item variants.

### P2 — `Button` has no icon-only size; `IconButton` is separate with a different variant set
`Button` sizes are `sm|md|lg` (no square/icon size), so icon-only buttons must
use `IconButton` — which has a *different* variant set (`ghost|outline|filled`
vs Button's `primary|secondary|ghost|destructive`) and a required `label`.
Bridging a single app "Button" abstraction onto both meant special-casing size
`icon` → `IconButton` and remapping variants. Aligning the variant vocabularies
(or giving `Button` an `icon`/square size) would simplify adoption.

### P2 — `AppShell` nav width doesn't follow a `SideNav` child's self-size
`AppShell`'s nav column is `inline-size: var(--cascivo-shell-aside-inline-size,
18rem)` (fixed), while `SideNav` self-sizes (`16rem` ↔ `4rem` rail). Dropping a
`SideNav` into `AppShell`'s `nav` slot therefore leaves dead space around the
rail unless the consumer manually sets `--cascivo-shell-aside-inline-size:
fit-content` (or syncs it to the collapsed state). Since `AppShell` + `SideNav`
are the obvious pairing, `AppShell` should default the nav column to hug its
content (or detect a `SideNav` child). Also: `SideNav` has `items`/`groups`/
`footer` but **no top/header slot**, so app-level context controls (cluster /
project pickers) can only go in `footer` — a header slot would help.

### P3 — Redundant / overlapping semantic color tokens
While bridging I found several near-synonyms that create ambiguity about which to
target:
- danger vs destructive vs error: `--cascivo-color-danger`,
  `--cascivo-color-destructive`, `--cascivo-color-error` (plus `*-content`,
  `*-foreground`, `*-subtle` variants of each).
- text vs foreground: `--cascivo-color-text` vs `--cascivo-color-foreground`
  (and `-muted`/`-subtle` of both).
- `--cascivo-color-on-accent` vs `--cascivo-color-text-on-accent`.

Picking one canonical name per concept (and documenting aliases if kept for
back-compat) would make brand-mapping unambiguous.

---

## What worked well (for balance)

- `@cascivo/react` **builds cleanly under a `react → preact/compat` Vite alias**
  — 75 KB JS, zero JS warnings. The signals runtime didn't fight Preact.
- The `data-theme`-on-root model lined up exactly with our existing brand theming
  (`@bpmnkit/ui` already switches `light/dark/neon` via `data-theme`), so once I
  understood the layering, the bridge was ~60 lines of pure CSS with no JS.
- The component coverage is excellent and console-shaped: `AppShell` + `SideNav`
  + `ShellHeader` + `DataTable` + `CommandMenu` + `ToastProvider` covered our
  app shell, tables, command palette, and toasts without gaps.
- Three-tier tokens (primitive → semantic → component) are the right model; the
  problem is purely that they're undocumented, not that they're wrong.

---

## Suggested top 5, in order

1. Publish a per-component API reference (generate from the `.d.ts` + one example
   each).
2. Document the theming model end-to-end, including the layer-cascade rule and a
   "map cascivo onto your brand tokens" recipe.
3. Fix the two CSS build issues in `@cascivo/tokens` (`@import` order; `@function`
   fallbacks).
4. State the supported framework/browser matrix and the Preact-alias story.
5. Add per-component subpath exports + `./package.json` to `exports`.
