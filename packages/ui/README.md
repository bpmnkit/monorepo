<div align="center">
  <img src="https://raw.githubusercontent.com/bpmnkit/monorepo/main/doc/logos/2026.svg" width="72" height="72" alt="BPMN Kit logo">
  <h1>@bpmnkit/ui</h1>
  <p>Shared design tokens, theme management, and UI components for BPMN Kit packages</p>

  [![npm](https://img.shields.io/npm/v/@bpmnkit/ui?style=flat-square&color=6244d7)](https://www.npmjs.com/package/@bpmnkit/ui)
  [![license](https://img.shields.io/npm/l/@bpmnkit/ui?style=flat-square)](https://github.com/bpmnkit/monorepo/blob/main/LICENSE)
  [![typescript](https://img.shields.io/badge/TypeScript-strict-6244d7?style=flat-square&logo=typescript&logoColor=white)](https://github.com/bpmnkit/monorepo)

  [Website](https://bpmnkit.com) · [Documentation](https://docs.bpmnkit.com) · [GitHub](https://github.com/bpmnkit/monorepo) · [Changelog](https://github.com/bpmnkit/monorepo/blob/main/packages/ui/CHANGELOG.md)
</div>

---

## Overview

`@bpmnkit/ui` is the shared design system for the BPMN Kit. It provides CSS custom property tokens, theme management utilities, and ready-made UI components (badges, cards, tables, theme switcher) used across the editor, canvas, plugins, and operate packages.

## Features

- **CSS design tokens** — `--bpmnkit-*` custom properties for colors, spacing, typography, and borders
- **Dark/light/auto theming** — persistent theme via `localStorage`, applies `data-theme` attribute
- **`injectUiStyles()`** — programmatically inject all tokens + component CSS into the document
- **UI components** — `badge(state)`, `createStatsCard()`, `createTable()`, theme switcher dropdown
- **Icons** — built-in SVG icon set (`IC_UI`)

## Installation

```sh
npm install @bpmnkit/ui
```

## Usage

### Inject tokens at runtime (packages / apps)

```typescript
import { injectUiStyles } from "@bpmnkit/ui"

// Call once before mounting your UI
injectUiStyles()
```

### Import tokens in Astro/CSS

```css
@import "@bpmnkit/ui/tokens.css";
```

### Theme management

```typescript
import { applyTheme, persistTheme, loadPersistedTheme } from "@bpmnkit/ui"

// Restore from localStorage on startup
const saved = loadPersistedTheme()  // "light" | "dark" | "auto"
applyTheme(document.documentElement, saved)

// Persist a user selection
persistTheme("dark")
applyTheme(document.documentElement, "dark")
```

### Theme switcher dropdown

```typescript
import { createThemeSwitcher } from "@bpmnkit/ui"

const { el, setTheme } = createThemeSwitcher({
  initial: "auto",
  persist: true,
  onChange: (theme) => applyTheme(document.body, theme),
})
document.querySelector(".toolbar")!.appendChild(el)
```

## Design Tokens

All tokens use the `--bpmnkit-*` prefix and are defined for both light and dark modes.

| Token | Purpose |
|-------|---------|
| `--bpmnkit-bg` | Page background |
| `--bpmnkit-surface` | Card / panel surface |
| `--bpmnkit-border` | Borders |
| `--bpmnkit-fg` | Primary text |
| `--bpmnkit-fg-muted` | Secondary text |
| `--bpmnkit-accent` | Primary accent / interactive |
| `--bpmnkit-accent-bright` | Links / bright accent |
| `--bpmnkit-teal` | Secondary accent |
| `--bpmnkit-success` | Success state |
| `--bpmnkit-warn` | Warning state |
| `--bpmnkit-danger` | Error / danger state |
| `--bpmnkit-font` | UI font stack |
| `--bpmnkit-font-mono` | Monospace font stack |

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
| [`@bpmnkit/profiles`](https://www.npmjs.com/package/@bpmnkit/profiles) | Shared auth, profile storage, and client factories for CLI & proxy |
| [`@bpmnkit/operate`](https://www.npmjs.com/package/@bpmnkit/operate) | Monitoring & operations frontend for Camunda clusters |
| [`@bpmnkit/connector-gen`](https://www.npmjs.com/package/@bpmnkit/connector-gen) | Generate connector templates from OpenAPI specs |
| [`@bpmnkit/cli`](https://www.npmjs.com/package/@bpmnkit/cli) | Camunda 8 command-line interface (casen) |
| [`@bpmnkit/proxy`](https://www.npmjs.com/package/@bpmnkit/proxy) | Local AI bridge and Camunda API proxy server |

## License

[MIT](https://github.com/bpmnkit/monorepo/blob/main/LICENSE) © BPMN Kit — made by [u11g](https://u11g.com)
