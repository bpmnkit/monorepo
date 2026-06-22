# cascivo `SideNav` — feedback for native sidebar footer items

**Package:** `@cascivo/react` (observed on `0.2.1`)
**Context:** A consumer app (bpmnkit Studio) builds its shell with `AppShell` +
`SideNav` + `ShellHeader`. The main page navigation maps cleanly to
`SideNav` `items[]`. The sidebar also needs a cluster of **app-context
controls** — two dropdown *pickers* (cluster profile, project), plus a few
*action* buttons (search, "get started", reconnect). Today these can only live
in the `footer` slot as hand-rolled markup, because the `SideNav` item model
can't express them. As a result the consumer must replicate `SideNav`'s internal
spacing (`_list`/`_link`/`_icon`) by hand to keep the footer aligned with native
items — which is brittle and drifts whenever cascivo retunes its tokens.

This document lists the `SideNav` enhancements that would let those controls
become **native, self-aligning items**.

---

## Current behavior (for reference)

```ts
interface SideNavSubItem { label: string; href: string; active?: boolean }
interface SideNavItem {
  label: string
  href?: string
  icon?: ReactNode
  active?: boolean
  items?: SideNavSubItem[]
  onClick?: (e: MouseEvent<HTMLAnchorElement>) => void
}
interface SideNavGroup { label?: string; items: SideNavItem[] }
```

- A **leaf item always renders as `<a href onClick>`** — even when `href` is
  omitted. (An `<a>` without `href` is not keyboard-focusable and ignores
  Enter/Space, so an `onClick`-only item is mouse-only.)
- A leaf item collapsed onto the rail is auto-wrapped in a cascivo `<Tooltip
  placement="right">` — nice, and something custom footer content doesn't get.
- An item with `items` renders an **expandable list** (expanded) or a **rail
  flyout popover** (collapsed). Every entry in both is a plain `<a href>` —
  navigation only.
- Alignment metrics: `_sideNav` padding `space-2`, `_list` padding-inline
  `space-2`, `_link` padding-inline `space-2`, `_icon` box `space-4`. Footer
  (`_footer`) has **no inline padding**, so custom footer content must add the
  `_list` + `_link` insets and a fixed `space-4` icon box by hand to line up.

---

## Requested changes

Ordered roughly by impact / unblocking power.

### 1. Button-mode items (focusable actions)

**Problem:** Action items (search, "get started", reconnect) have an `onClick`
but no `href`. They render as `<a onClick>` with no `href` → not in the tab
order, no Enter/Space activation.

**Proposal:** When an item has `onClick` and no `href`, render a real
`<button type="button">` (same `_link` styling), so it's keyboard-accessible.
No API change required — purely a rendering fix keyed on `href === undefined`.

**Acceptance:** An `onClick`-only item is Tab-focusable and activates on
Enter/Space; with `href` it stays an `<a>` (unchanged).

### 2. Item `disabled`, `tone`/`variant`, and a trailing slot

**Problem:** The reconnect control needs a disabled state (while reconnecting),
a non-default color (warning), and ideally a spinner. Search wants a trailing
`⌘K` hint. `SideNavItem` has none of these.

**Proposal:**
```ts
interface SideNavItem {
  // ...existing
  disabled?: boolean
  tone?: 'default' | 'danger' | 'warning' | 'success'   // or reuse cascivo's variant scale
  trailing?: ReactNode                                  // e.g. a Kbd, badge, count
}
```

**Acceptance:** `disabled` items are non-interactive and visually dimmed;
`tone` recolors the item; `trailing` renders right-aligned after the label and
is hidden on the rail.

### 3. Actionable / rich sub-items — OR a menu item (the picker blocker)

**Problem:** The pickers are dropdown **selects**: a trigger that opens a menu
of profiles/projects with `onSelect` actions, section labels, separators, a
"selected" ✓, and trailing footer links ("Add profile →"). `SideNavItem`'s only
expansion is `SideNavSubItem`, which is **href-only** — it cannot run an action
like `setActiveProfile(name)`, show a checkmark, or include labels/separators.
So the pickers cannot be `SideNav` items at all.

**Proposal (pick one):**

**3a — richer sub-items.** Make `items` a small union so an expandable item can
be a real menu (inline when expanded, flyout on the rail):
```ts
type SideNavSubItem =
  | { label: string; href?: string; icon?: ReactNode; active?: boolean;
      selected?: boolean; onSelect?: () => void; disabled?: boolean }
  | { type: 'separator' }
  | { type: 'label'; label: string }
```

**3b — menu item slot.** Let an item anchor an arbitrary cascivo
`Dropdown`/`Menu` (reuses existing components, maximum flexibility):
```ts
interface SideNavItem {
  // ...existing
  menu?: ReactNode   // rendered in a popover anchored to the item trigger
}
```

**Acceptance:** A picker can be declared as a single `SideNav` item whose
expansion/menu lists selectable entries that run callbacks, show the active
selection, and include labels/separators — matching the item's alignment and
rail/flyout behavior.

> Note: option 3b (and faithful pickers generally) also depends on cascivo
> `Menu` gaining `MenuLabel`, separators, and selectable/checkbox items — see
> the existing Menu feedback. 3a sidesteps that by building the menu into
> `SideNav` itself.

### 4. Custom-item escape hatch / compound primitive (also fixes alignment)

**Problem:** Anything cascivo doesn't model (a bespoke picker, a status row,
etc.) must live in `footer` and **hand-replicate** `_list`/`_link`/`_icon`
spacing to align with native items. That duplication silently breaks when
cascivo changes its spacing tokens.

**Proposal:** Expose the item shell as a reusable building block so custom
content inherits layout/alignment, collapse/tooltip behavior, and theming for
free. Either a compound component:
```tsx
<SideNav>
  <SideNav.Item icon={<Search/>} label="Search" onClick={...} trailing={<Kbd>⌘K</Kbd>} />
  <SideNav.Item label="Cluster">{/* arbitrary control, e.g. a Dropdown */}</SideNav.Item>
</SideNav>
```
…or a `render?: (ctx: { collapsed: boolean }) => ReactNode` on `SideNavItem`,
and/or documented, stable CSS parts (`::part(item)`, `::part(icon)`) consumers
can target.

**Acceptance:** Custom content placed via the primitive lines up pixel-for-pixel
with native items in both expanded and collapsed states, with no app-side
spacing math.

### 5. `header` slot (minor)

**Problem:** `footer` is the only custom slot. App-context controls (the
pickers) are conventionally placed at the **top** of the sidebar, under the
brand. The consumer currently has to put them in `footer` (bottom).

**Proposal:** Add a `header?: ReactNode` slot mirroring `footer` (rendered above
`items`, inside the same padding context).

**Acceptance:** `header` content renders at the top of the nav, respects the
collapsed rail, and shares the item padding context.

---

## What each unblocks (summary)

| Control | Needs |
|---|---|
| Search, "Get started" | #1 (button mode); #2 `trailing` for the `⌘K` hint |
| Reconnect | #1 + #2 (`disabled`, `tone="warning"`, spinner via `icon`) |
| Cluster / Project pickers | #3 (or #4 escape hatch) — the real blocker; plus cascivo `Menu` richness for 3b |
| Placement (pickers at top) | #5 `header` slot |
| Any future custom control + alignment | #4 |

**Minimum to make the whole footer native and self-aligning:** #1 + #2 + (#3a or #4).
