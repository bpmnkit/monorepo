# Cascivo UI Migration Plan

Adopt the [cascivo](https://cascivo.com) design system across the bpmnkit
frontends, primarily the **studio** console (an exact match for cascivo's
`AppShell` console use case).

## Decisions (agreed)

| Question | Decision |
|---|---|
| Migration aggressiveness | **Full replacement** — remove Tailwind, rebuild on cascivo tokens + components |
| Consumption model | **`@cascivo/react`** prebuilt npm package (not the copy-paste CLI) |
| Scope this round | **studio** (primary), **`@bpmnkit/operate`** package, **desktop** app |
| Brand tokens | `@bpmnkit/ui` stays the single source of truth; cascivo color tokens are *bridged* onto `--bpmnkit-*` |

Astro apps (landing / learn / docs) are explicitly out of scope for now.

## What cascivo is (verified)

- shadcn-style design system; CLI (`npx cascivo init/add`) **or** the
  `@cascivo/react` package (we use the package).
- **Pure CSS** — no Tailwind, no CSS-in-JS. Uses `@layer`, `@container`,
  `:has()`, CSS custom properties, and (bleeding-edge) CSS `@function`.
- **Preact Signals**-driven reactivity; peers: `react >=18`, `react-dom >=18`,
  `@preact/signals-react >=2`.
- Three-tier tokens (primitive → semantic → component), themed via a
  `data-theme` attribute. 165 components across Display / Inputs / Layout /
  Navigation / Charts / Overlay / Feedback, plus `AppShell` layout.
- Packages used here: `@cascivo/react` (components + `./styles.css`),
  `@cascivo/themes` (theme/base CSS), `@cascivo/tokens` (primitives).

### Verified compatibility (de-risking done up front)

- `@cascivo/react` (incl. `AppShell`, `SideNav`, `ShellHeader`, `DataTable`,
  `ToastProvider`, `Modal`, `Dropdown`, `Tooltip`, `CommandMenu`, …) **builds
  clean under the studio's exact `react → preact` Vite alias** — proven with an
  isolated `@preact/preset-vite` build (75 KB JS, zero warnings).
- The full CSS composition (cascivo tokens + base + component styles + brand
  bridge) **builds through the studio's real Tailwind v4 + Vite toolchain**
  (264 KB CSS emitted).
- `data-theme` is already how `@bpmnkit/ui` applies the `light` / `dark` /
  `neon` brand themes on `document.documentElement`, so the theming hook lines
  up exactly — no new theme plumbing needed.

### Known, non-fatal warnings (upstream — `@cascivo/tokens`, which we own)

1. `@import must precede all other statements` — `@cascivo/tokens` has an
   internal `@import` after a non-empty `@layer`. Fix at the source by moving it
   to the top of the file.
2. `[lightningcss] Unknown at rule: @function` — `@cascivo/tokens/functions.css`
   uses draft CSS `@function`; Tailwind v4's lightningcss minifier can't parse
   it yet, so `--cascivo-step` / `--cascivo-scale` are dropped. Mitigate by not
   depending on those derived tokens in the studio, or emit static fallbacks in
   `@cascivo/tokens`. Re-evaluate once lightningcss ships `@function` support.

## Token strategy — brand stays authoritative

`apps/studio/src/styles/cascivo.css` pulls **structure** (radii, spacing,
typography, shadows, z-index, motion) from cascivo's primitive + base layers,
and maps every cascivo **semantic color** token onto the `--bpmnkit-*` brand
tokens. Because `--bpmnkit-*` already re-resolve per
`[data-theme="light|dark|neon"]`, a single unlayered `:root` block themes all
cascivo components across all three brand themes (including `neon`, which has no
first-party cascivo theme). This keeps `packages/ui` the single source of truth
per the repo brand-token rules.

## Studio component mapping (studio → cascivo)

| Studio today | Cascivo replacement |
|---|---|
| `layout/Shell` + `Sidebar` + `TopBar` | `AppShell` + `SideNav` + `ShellHeader` |
| `components/ui/button` | `Button` / `IconButton` / `ButtonGroup` |
| `components/ui/badge` + `StatusPill` | `Badge` + `Status` / `Tag` |
| `components/ui/dialog` | `Modal` / `Drawer` / `Sheet` / `AlertDialog` |
| `components/ui/dropdown-menu` | `Dropdown` / `Menu` / `OverflowMenu` |
| `components/ui/tabs` | `Tabs` / `TabsList` / `TabsTrigger` / `TabsContent` |
| `components/ui/tooltip` | `Tooltip` / `Toggletip` |
| `components/ui/popover` | `Popover` / `HoverCard` |
| `components/ui/input` + `separator` | `Input` / `Field` / `Search` + `Separator` |
| `components/Toast` + `stores/toast` | `ToastProvider` + `useToast` / `enqueue` |
| `components/CommandPalette` | `CommandMenu` |
| `components/ErrorState` | `EmptyState` |
| list pages (`Instances`/`Incidents`/`Tasks`/…) tables | `DataTable` |
| dashboard metrics | `Stat` / `Card` / `Tile` |

After migration these allow removing `@radix-ui/*`, `class-variance-authority`,
`clsx`, `tailwind-merge`, `lucide-react` (cascivo ships `@cascivo/icons`), and
Tailwind itself from the studio.

## Staged execution

Each stage must build, typecheck, lint, and visually pass **before** the next.
Stages are ordered so the app keeps working throughout (Tailwind is removed only
in the final stage, once nothing depends on it).

- [x] **Stage 0 — Foundation.** Add `@cascivo/react` / `@cascivo/themes` /
  `@cascivo/tokens` / `@preact/signals-react`; add `src/styles/cascivo.css`
  brand bridge; import it from `globals.css`. *(done — this change)*
- [~] **Stage 1 — Primitives.** *In progress.* Migrated **Button**, **Badge**,
  **Separator** to thin `@cascivo/react` adapters that keep the existing
  call-site API (variant names mapped: `default→primary`, `outline→secondary`,
  `danger→destructive`, `warn→warning`, `muted→secondary`), so the 10 Button /
  2 Badge / 1 Separator sites are unchanged. Dropped `asChild` from Button (only
  `ErrorState` used it — switched to an `onClick` navigation). **Deferred** in
  this stage:
  - **Input** — cascivo `Input` always renders a wrapper `<div>` and applies
    `className` to the wrapper, not the `<input>`; re-exporting it would regress
    the studio's bare-input search boxes (`className="pl-8"` icon padding). Move
    these to cascivo `Search` / `Field` during the list-page work (Stage 4).
  - **Dialog → Modal** and **DropdownMenu → Dropdown/Menu** — compositional APIs
    differ entirely from Radix; these need call-site rewrites (Stage 1b).
  - `tabs` / `tooltip` / `popover` wrappers are **dead code** (no importers) —
    will be deleted alongside the Radix dependency once nothing uses Radix.

  **Required foundation fix (also part of this stage):** the studio uses
  `jsxImportSource: "preact"` with no `react → preact/compat` type alias, so
  cascivo's React-typed `.d.ts` resolved against real `react@19` and failed to
  typecheck (`children does not exist on ButtonProps`). Added a `paths` alias in
  `apps/studio/tsconfig.json` mapping `react` / `react-dom` / `react/jsx-runtime`
  to `preact/compat`; verified in isolation that cascivo **and** the existing
  Radix / react-query usage typecheck together with it.
- [~] **Stage 1b — Overlays.** *In progress.*
  - **Dialog → Modal: done.** Rewrote all 8 dialog instances across
    `WelcomeModal`, `Models` (×5), and `Settings` to cascivo `Modal` (string
    `title`, `onClose`, `size`), and deleted `components/ui/dialog.tsx`.
    `WelcomeModal` (custom centred title) uses a title-less `Modal` + `<h2>`.
  - Routed `Button size="icon"` (3 sites) to cascivo **`IconButton`** inside the
    Button adapter, deriving its required `label` from `aria-label` — call sites
    unchanged.
  - Removed the now-orphaned direct deps `@radix-ui/react-separator`,
    `@radix-ui/react-slot`, `class-variance-authority` (no remaining importers
    after Button/Separator/Dialog migration). `@radix-ui/react-dialog` stays —
    still used by `CommandPalette`.
  - **DropdownMenu → cascivo Menu: deferred.** cascivo `Menu` is minimal
    (`MenuItem{children,onSelect,disabled}`, `MenuTrigger`, `MenuSeparator`) and
    lacks a `MenuLabel`, `asChild` trigger/item, and checkbox/radio items — all
    of which the studio's cluster/project/actions menus rely on (section labels,
    custom-styled `asChild` triggers, `asChild` links). Migrating now would be
    lossy and is not visually verifiable in this environment. Tracked as cascivo
    feedback; revisit when `Menu` gains those features, or rewrite the menus'
    information architecture to fit. See `doc/cascivo-feedback.md`.
- [ ] **Stage 1c — Cleanup.** Once `DropdownMenu` is migrated: delete the dead
  `tabs`/`tooltip`/`popover` wrappers and drop the remaining `@radix-ui/*`,
  `clsx`, `tailwind-merge`.
- [~] **Stage 2 — App shell.** *In progress.*
  - `Shell` now uses cascivo **`AppShell`** (header = the existing `TopBar`,
    nav = `Sidebar`, content = main + `AIDrawer`). Zen mode bypasses AppShell for
    a chrome-free full-screen view. The nav column is set to
    `--cascivo-shell-aside-inline-size: fit-content` so the self-sizing `SideNav`
    drives its own width.
  - `Sidebar` rewritten onto cascivo **`SideNav`**: the 9 nav links → `items[]`
    (label/href/icon/active; navigation still flows through the Shell's global
    `<a>` interceptor for view transitions). The collapse rail is now `SideNav`'s
    native `collapsed` (wired to `sidebarExpanded`) + `expandOnHover` + its own
    collapse toggle. The cluster/project pickers, search, reconnect, and "Get
    started" live in `SideNav`'s **`footer`** slot (per decision), still on Radix
    `DropdownMenu` (deferred).
  - **Correction:** an earlier analysis wrongly claimed cascivo couldn't do a
    collapsible rail sidebar. It can — `SideNav` self-sizes `16rem ↔ 4rem` rail
    with hover-expand. The real (resolved) issue was *wrapping the studio's own
    self-transforming sidebar* in AppShell; using cascivo `SideNav` avoids it.
  - **Known follow-ups (need browser verification):** (1) `TopBar` kept as-is
    (not `ShellHeader`) because it's breadcrumb-centric — so there's no header
    burger; on mobile AppShell starts the nav closed and nothing reopens it.
    Wire a mobile drawer toggle (separate from the desktop `sidebarExpanded`
    rail state) or move `TopBar` to `ShellHeader`. (2) Lost the offline-dimming
    of proxy-required nav items and the per-item keyboard-shortcut hints in
    collapsed tooltips (`SideNav` items have no such props). (3) Verify footer
    padding/width and pickers collapsing to icons at the 4rem rail.
- [ ] **Stage 3 — Toast + command palette.** Mount `ToastProvider`; migrate the
  toast store callers to `useToast`/`enqueue`; swap `CommandPalette` →
  `CommandMenu`.
- [ ] **Stage 4 — List pages.** Move `Instances` / `Incidents` / `Tasks` /
  `Definitions` / `Decisions` / `Models` tables to `DataTable`; detail pages to
  `Card` / `Stat` / `DataList` / `Timeline`.
- [ ] **Stage 5 — Remaining pages & chrome.** `Dashboard`, `Settings`,
  `RunHistory`, modals, empty/error states.
- [ ] **Stage 6 — Remove Tailwind.** Delete `@tailwindcss/vite`, the
  `@theme inline` block, the tailwindcss-animate utilities, and all utility
  classes; drop Radix / cva / clsx / tailwind-merge / lucide-react.
- [ ] **Stage 7 — `@bpmnkit/operate`.** Apply the same swap to the operate React
  views consumed by the studio.
- [ ] **Stage 8 — desktop.** Wire cascivo into the desktop shell (mirrors the
  studio entry + theme bridge).

## Risks & mitigations

- **Studio build can't go fully green in CI/web sandboxes.** `@bpmnkit/reebe-wasm`
  ships generated WASM artifacts (`reebe_wasm.js/.d.ts`) that are not committed
  and require a Rust/wasm-pack build; without them the engine → canvas → studio
  typecheck/build chain fails *independent of this work*. Verify cascivo changes
  via isolated CSS/JS builds + Biome until the WASM artifacts are buildable in
  the environment.
- **React 19 vs preact alias.** Installing `@cascivo/react` pulls `react@19` to
  satisfy peers, but Vite's `react → preact/compat` alias wins at bundle time
  (verified). Keep the alias; do not add real `react-dom` rendering.
- **Prop-API differences.** cascivo variant/size/label props differ from the
  current Radix+cva primitives; reconcile per component during Stage 1.
- **`@function` / `@import` warnings.** Upstream `@cascivo/tokens` issues (see
  above) — fixable at the source.

## Implemented in this change (Stage 0)

- `apps/studio/package.json` — added `@cascivo/react`, `@cascivo/themes`,
  `@cascivo/tokens`, `@preact/signals-react`.
- `apps/studio/src/styles/cascivo.css` — cascivo imports + brand-token bridge.
- `apps/studio/src/styles/globals.css` — imports `./cascivo.css`.
