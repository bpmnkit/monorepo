<div align="center">
  <img src="https://raw.githubusercontent.com/bpmn-sdk/monorepo/main/doc/logos/logo-2-gateway.svg" width="72" height="72" alt="BPMN Kit logo">
  <h1>@bpmnkit/ui</h1>
  <p>Shared design tokens, theme management, and UI components for bpmn-sdk frontends</p>

  [![npm](https://img.shields.io/npm/v/@bpmnkit/ui?style=flat-square&color=6244d7)](https://www.npmjs.com/package/@bpmnkit/ui)
  [![license](https://img.shields.io/npm/l/@bpmnkit/ui?style=flat-square)](https://github.com/bpmnkit/monorepo/blob/main/LICENSE)
  [![typescript](https://img.shields.io/badge/TypeScript-strict-6244d7?style=flat-square&logo=typescript&logoColor=white)](https://github.com/bpmnkit/monorepo)

  [Documentation](https://bpmn-sdk-docs.pages.dev) · [GitHub](https://github.com/bpmnkit/monorepo) · [Changelog](https://github.com/bpmnkit/monorepo/blob/main/packages/ui/CHANGELOG.md)
</div>

---

## Overview

`@bpmnkit/ui` is the shared design-system foundation for all bpmn-sdk frontends (`@bpmnkit/editor`, `@bpmnkit/operate`, `@bpmnkit/canvas`). It provides:

- **CSS custom property tokens** — a single, consistent colour palette, spacing, radius, and typography scale shared across all packages
- **Theme management** — resolve, persist, and apply `light` / `dark` / `auto` themes with zero boilerplate
- **Primitive UI components** — badge, stats card, data table, and a theme-switcher button/dropdown, all built on plain DOM with no framework
- **SVG icon library** — crisp 16 × 16 icons for navigation and theme controls

No runtime dependencies. Works in any browser environment or bundler.

## Features

- **Design tokens** — `--bpmnkit-*` CSS custom properties for surfaces, borders, typography, accent, semantic colours (success/warn/danger), radius, and navigation chrome
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
npm install @bpmnkit/ui
```

## Quick Start

### Inject styles and apply a theme

```typescript
import { injectUiStyles, applyTheme, loadPersistedTheme } from "@bpmnkit/ui"

// Inject CSS tokens and component styles once at app start
injectUiStyles()

// Apply persisted or default theme to the app root element
const root = document.getElementById("app")!
applyTheme(root, loadPersistedTheme() ?? "auto")
```

### Theme switcher button

```typescript
import { createThemeSwitcher } from "@bpmnkit/ui"

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
import { badge } from "@bpmnkit/ui"

const el = badge("ACTIVE")    // → <span class="bpmn-badge bpmn-badge--active">ACTIVE</span>
container.appendChild(el)
```

### Stats card

```typescript
import { createStatsCard } from "@bpmnkit/ui"

const card = createStatsCard("Active Instances", 42, "clickable")
card.addEventListener("click", () => navigate("/instances"))
grid.appendChild(card)
```

### Data table

```typescript
import { createTable } from "@bpmnkit/ui"

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
| `--bpmnkit-bg` | `#f4f4f8` | `#0f0f1a` |
| `--bpmnkit-surface` | `#ffffff` | `#1a1a2e` |
| `--bpmnkit-surface-2` | `#f0f0f8` | `#222240` |
| `--bpmnkit-border` | `#d8d8e8` | `#2e2e4e` |
| `--bpmnkit-fg` | `#1a1a2e` | `#e0e0f0` |
| `--bpmnkit-fg-muted` | `#6666a0` | `#8888a8` |
| `--bpmnkit-accent` | `#1a56db` | `#4c8ef7` |
| `--bpmnkit-success` | `#22c55e` | `#22c55e` |
| `--bpmnkit-warn` | `#f59e0b` | `#f59e0b` |
| `--bpmnkit-danger` | `#ef4444` | `#ef4444` |
| `--bpmnkit-radius` | `6px` | `6px` |
| `--bpmnkit-nav-bg` | `#1e2030` | `#14141f` |

### Icons (`IC_UI`)

```typescript
import { IC_UI } from "@bpmnkit/ui"

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
| [`@bpmnkit/core`](https://www.npmjs.com/package/@bpmnkit/core) | BPMN/DMN/Form parser, builder, layout engine |
| [`@bpmnkit/canvas`](https://www.npmjs.com/package/@bpmnkit/canvas) | Zero-dependency SVG BPMN viewer |
| [`@bpmnkit/editor`](https://www.npmjs.com/package/@bpmnkit/editor) | Full-featured interactive BPMN editor |
| [`@bpmnkit/engine`](https://www.npmjs.com/package/@bpmnkit/engine) | Lightweight BPMN process execution engine |
| [`@bpmnkit/feel`](https://www.npmjs.com/package/@bpmnkit/feel) | FEEL expression language parser & evaluator |
| [`@bpmnkit/plugins`](https://www.npmjs.com/package/@bpmnkit/plugins) | 22 composable canvas plugins |
| [`@bpmnkit/api`](https://www.npmjs.com/package/@bpmnkit/api) | Camunda 8 REST API TypeScript client |
| [`@bpmnkit/ascii`](https://www.npmjs.com/package/@bpmnkit/ascii) | Render BPMN diagrams as Unicode ASCII art |
| [`@bpmnkit/profiles`](https://www.npmjs.com/package/@bpmnkit/profiles) | Shared auth, profile storage, and client factories |
| [`@bpmnkit/operate`](https://www.npmjs.com/package/@bpmnkit/operate) | Monitoring & operations frontend for Camunda clusters |

## License

[MIT](https://github.com/bpmnkit/monorepo/blob/main/LICENSE) © bpmn-sdk
