<div align="center">
  <img src="https://raw.githubusercontent.com/bpmn-sdk/monorepo/main/doc/logos/logo-2-gateway.svg" width="72" height="72" alt="BPMN SDK logo">
  <h1>@bpmn-sdk/ui</h1>
  <p>Shared design tokens, theme management, and UI components for bpmn-sdk frontends</p>

  [![npm](https://img.shields.io/npm/v/@bpmn-sdk/ui?style=flat-square&color=6244d7)](https://www.npmjs.com/package/@bpmn-sdk/ui)
  [![license](https://img.shields.io/npm/l/@bpmn-sdk/ui?style=flat-square)](https://github.com/bpmn-sdk/monorepo/blob/main/LICENSE)
  [![typescript](https://img.shields.io/badge/TypeScript-strict-6244d7?style=flat-square&logo=typescript&logoColor=white)](https://github.com/bpmn-sdk/monorepo)

  [Documentation](https://bpmn-sdk-docs.pages.dev) · [GitHub](https://github.com/bpmn-sdk/monorepo) · [Changelog](https://github.com/bpmn-sdk/monorepo/blob/main/packages/ui/CHANGELOG.md)
</div>

---

## Overview

`@bpmn-sdk/ui` is the shared design-system foundation for all bpmn-sdk frontends (`@bpmn-sdk/editor`, `@bpmn-sdk/operate`, `@bpmn-sdk/canvas`). It provides:

- **CSS custom property tokens** — a single, consistent colour palette, spacing, radius, and typography scale shared across all packages
- **Theme management** — resolve, persist, and apply `light` / `dark` / `auto` themes with zero boilerplate
- **Primitive UI components** — badge, stats card, data table, and a theme-switcher button/dropdown, all built on plain DOM with no framework
- **SVG icon library** — crisp 16 × 16 icons for navigation and theme controls

No runtime dependencies. Works in any browser environment or bundler.

## Features

- **Design tokens** — `--bpmn-*` CSS custom properties for surfaces, borders, typography, accent, semantic colours (success/warn/danger), radius, and navigation chrome
- **Unified blue accent** — `#1a56db` (light) / `#4c8ef7` (dark), consistent across editor, canvas, and operate
- **Light / dark / auto theming** — light defaults on `:root`; `[data-theme="dark"]` override matches any element with that attribute
- **`createThemeSwitcher()`** — standalone Dark / Light / System button + dropdown; persists to `localStorage`
- **`badge(state)`** — coloured status badge for process-instance and job states
- **`createStatsCard()`** — dashboard metric card with value and label
- **`createTable<T>()`** — generic, typed data table with clickable rows and empty state
- **`IC_UI` icons** — moon, sun, auto, checkmark, dashboard, processes, instances, incidents, jobs, tasks
- **`injectUiStyles()`** — single call injects tokens + component CSS into `<head>`, deduplicated

## Installation

```sh
npm install @bpmn-sdk/ui
```

## Quick Start

### Inject styles and apply a theme

```typescript
import { injectUiStyles, applyTheme, loadPersistedTheme } from "@bpmn-sdk/ui"

// Inject CSS tokens and component styles once at app start
injectUiStyles()

// Apply persisted or default theme to the app root element
const root = document.getElementById("app")!
applyTheme(root, loadPersistedTheme() ?? "auto")
```

### Theme switcher button

```typescript
import { createThemeSwitcher } from "@bpmn-sdk/ui"

const switcher = createThemeSwitcher({
  initial: "auto",
  persist: true,                               // saves to localStorage
  onChange(theme, resolved) {
    applyTheme(appRoot, theme)                 // update your root element
  },
})

toolbar.appendChild(switcher.el)
```

### Badge

```typescript
import { badge } from "@bpmn-sdk/ui"

const el = badge("ACTIVE")    // → <span class="bpmn-badge bpmn-badge--active">ACTIVE</span>
container.appendChild(el)
```

### Stats card

```typescript
import { createStatsCard } from "@bpmn-sdk/ui"

const card = createStatsCard("Active Instances", 42, "clickable")
card.addEventListener("click", () => navigate("/instances"))
grid.appendChild(card)
```

### Data table

```typescript
import { createTable } from "@bpmn-sdk/ui"

const { el, setRows } = createTable({
  columns: [
    { label: "Name",  render: (row) => row.name },
    { label: "State", render: (row) => badge(row.state), width: "100px" },
  ],
  onRowClick: (row) => openDetail(row.id),
  emptyText: "No results",
})

container.appendChild(el)
setRows(data)
```

## API Reference

### Theme

```typescript
type Theme = "light" | "dark" | "auto"

resolveTheme(theme: Theme): "light" | "dark"
applyTheme(el: HTMLElement, theme: Theme): void    // sets data-theme on el
persistTheme(theme: Theme): void                    // writes to localStorage
loadPersistedTheme(): Theme | null                  // reads from localStorage
```

### `createThemeSwitcher(options)`

```typescript
interface ThemeSwitcherOptions {
  initial?: Theme
  onChange: (theme: Theme, resolved: "light" | "dark") => void
  persist?: boolean   // default: false
}

createThemeSwitcher(options): { el: HTMLElement; setTheme(t: Theme): void }
```

### Components

| Export | Signature | Description |
|--------|-----------|-------------|
| `badge` | `(state: string) → HTMLElement` | Coloured status badge |
| `cell` | `(text: string \| null) → HTMLElement` | Plain text cell for use in tables |
| `createStatsCard` | `(label, value, mod?) → HTMLElement` | Dashboard metric card; `mod`: `"clickable"` \| `"warn"` |
| `createTable` | `<T>(options: TableOptions<T>) → { el, setRows }` | Generic typed data table |

### CSS tokens

| Token | Light | Dark |
|-------|-------|------|
| `--bpmn-bg` | `#f4f4f8` | `#0f0f1a` |
| `--bpmn-surface` | `#ffffff` | `#1a1a2e` |
| `--bpmn-surface-2` | `#f0f0f8` | `#222240` |
| `--bpmn-border` | `#d8d8e8` | `#2e2e4e` |
| `--bpmn-fg` | `#1a1a2e` | `#e0e0f0` |
| `--bpmn-fg-muted` | `#6666a0` | `#8888a8` |
| `--bpmn-accent` | `#1a56db` | `#4c8ef7` |
| `--bpmn-success` | `#22c55e` | `#22c55e` |
| `--bpmn-warn` | `#f59e0b` | `#f59e0b` |
| `--bpmn-danger` | `#ef4444` | `#ef4444` |
| `--bpmn-radius` | `6px` | `6px` |
| `--bpmn-nav-bg` | `#1e2030` | `#14141f` |

### Icons (`IC_UI`)

```typescript
import { IC_UI } from "@bpmn-sdk/ui"

// Theme icons
IC_UI.moon    // Dark theme
IC_UI.sun     // Light theme
IC_UI.auto    // System / auto theme
IC_UI.check   // Checkmark (used inside dropdowns)

// Navigation icons
IC_UI.dashboard   IC_UI.processes   IC_UI.instances
IC_UI.incidents   IC_UI.jobs        IC_UI.tasks
```

---

## Related Packages

| Package | Description |
|---------|-------------|
| [`@bpmn-sdk/core`](https://www.npmjs.com/package/@bpmn-sdk/core) | BPMN/DMN/Form parser, builder, layout engine |
| [`@bpmn-sdk/canvas`](https://www.npmjs.com/package/@bpmn-sdk/canvas) | Zero-dependency SVG BPMN viewer |
| [`@bpmn-sdk/editor`](https://www.npmjs.com/package/@bpmn-sdk/editor) | Full-featured interactive BPMN editor |
| [`@bpmn-sdk/engine`](https://www.npmjs.com/package/@bpmn-sdk/engine) | Lightweight BPMN process execution engine |
| [`@bpmn-sdk/feel`](https://www.npmjs.com/package/@bpmn-sdk/feel) | FEEL expression language parser & evaluator |
| [`@bpmn-sdk/plugins`](https://www.npmjs.com/package/@bpmn-sdk/plugins) | 22 composable canvas plugins |
| [`@bpmn-sdk/api`](https://www.npmjs.com/package/@bpmn-sdk/api) | Camunda 8 REST API TypeScript client |
| [`@bpmn-sdk/ascii`](https://www.npmjs.com/package/@bpmn-sdk/ascii) | Render BPMN diagrams as Unicode ASCII art |
| [`@bpmn-sdk/profiles`](https://www.npmjs.com/package/@bpmn-sdk/profiles) | Shared auth, profile storage, and client factories |
| [`@bpmn-sdk/operate`](https://www.npmjs.com/package/@bpmn-sdk/operate) | Monitoring & operations frontend for Camunda clusters |

## License

[MIT](https://github.com/bpmn-sdk/monorepo/blob/main/LICENSE) © bpmn-sdk
