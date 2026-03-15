<div align="center">
  <img src="https://raw.githubusercontent.com/bpmn-sdk/monorepo/main/doc/logos/logo-2-gateway.svg" width="72" height="72" alt="BPMN Kit logo">
  <h1>@bpmnkit/canvas</h1>
  <p>Zero-dependency SVG BPMN viewer with pan/zoom, theming, and a plugin API</p>

  [![npm](https://img.shields.io/npm/v/@bpmnkit/canvas?style=flat-square&color=6244d7)](https://www.npmjs.com/package/@bpmnkit/canvas)
  [![license](https://img.shields.io/npm/l/@bpmnkit/canvas?style=flat-square)](https://github.com/bpmnkit/monorepo/blob/main/LICENSE)
  [![typescript](https://img.shields.io/badge/TypeScript-strict-6244d7?style=flat-square&logo=typescript&logoColor=white)](https://github.com/bpmnkit/monorepo)

  [Documentation](https://bpmn-sdk-docs.pages.dev) · [GitHub](https://github.com/bpmnkit/monorepo) · [Changelog](https://github.com/bpmnkit/monorepo/blob/main/packages/canvas/CHANGELOG.md)
</div>

---

## Overview

`@bpmnkit/canvas` renders BPMN 2.0 diagrams as interactive SVG. It has zero runtime dependencies, works in any framework (or none), and exposes a plugin API for extending its behaviour.

## Features

- **SVG rendering** — crisp diagrams at any zoom level, all element types
- **Pan & zoom** — mouse drag, scroll wheel, touch/pinch, keyboard shortcuts
- **Theming** — light / dark / system-auto, fully overridable via CSS custom properties
- **Plugin API** — install composable `CanvasPlugin` add-ons without touching core code
- **Event system** — subscribe to element clicks, selection changes, diagram load, viewport updates
- **Keyboard navigation** — arrow keys, fit-to-screen, zoom shortcuts
- **Zero dependencies** — runs in browsers, bundlers, and SSR

## Installation

```sh
npm install @bpmnkit/canvas
```

## Quick Start

```typescript
import { BpmnCanvas } from "@bpmnkit/canvas"

const canvas = new BpmnCanvas({
  container: document.getElementById("canvas")!,
  theme: "dark",          // "light" | "dark" | "auto"
  grid: true,             // dot-grid background
  plugins: [],            // CanvasPlugin[]
})

// Load a diagram
canvas.loadXML(bpmnXml)

// Respond to element clicks
canvas.on("element:click", (id, event) => {
  console.log("Clicked:", id)
})

// Fit diagram to container
canvas.fit()
```

## API Reference

### Constructor Options

```typescript
interface CanvasOptions {
  container: HTMLElement
  theme?: "light" | "dark" | "auto"   // default: "auto"
  grid?: boolean                       // default: false
  fit?: boolean                        // auto-fit on load, default: true
  plugins?: CanvasPlugin[]
}
```

### CanvasApi Methods

| Method | Description |
|--------|-------------|
| `loadXML(xml)` | Parse and render a BPMN XML string |
| `fit()` | Fit the diagram to the container |
| `zoom(factor)` | Set zoom level (1 = 100%) |
| `getShapes()` | All rendered `RenderedShape` objects |
| `getEdges()` | All rendered `RenderedEdge` objects |
| `setTheme(theme)` | Switch theme at runtime |
| `destroy()` | Remove canvas and clean up |
| `on(event, handler)` | Subscribe to a canvas event |
| `off(event, handler)` | Unsubscribe |

### Events

| Event | Payload | Description |
|-------|---------|-------------|
| `diagram:load` | `BpmnDefinitions` | Fired when a new diagram loads |
| `element:click` | `(id, PointerEvent)` | An element was clicked |
| `editor:select` | `string[]` | Selection changed (element IDs) |
| `viewport:change` | `ViewportState` | Pan or zoom occurred |

### Plugin API

```typescript
import type { CanvasPlugin, CanvasApi } from "@bpmnkit/canvas"

const myPlugin: CanvasPlugin = {
  name: "my-plugin",
  install(api: CanvasApi) {
    api.on("element:click", (id) => console.log("clicked", id))
  },
  uninstall() {},
}
```

---

## Related Packages

| Package | Description |
|---------|-------------|
| [`@bpmnkit/core`](https://www.npmjs.com/package/@bpmnkit/core) | BPMN/DMN/Form parser, builder, layout engine |
| [`@bpmnkit/editor`](https://www.npmjs.com/package/@bpmnkit/editor) | Full-featured interactive BPMN editor |
| [`@bpmnkit/engine`](https://www.npmjs.com/package/@bpmnkit/engine) | Lightweight BPMN process execution engine |
| [`@bpmnkit/feel`](https://www.npmjs.com/package/@bpmnkit/feel) | FEEL expression language parser & evaluator |
| [`@bpmnkit/plugins`](https://www.npmjs.com/package/@bpmnkit/plugins) | 22 composable canvas plugins |
| [`@bpmnkit/api`](https://www.npmjs.com/package/@bpmnkit/api) | Camunda 8 REST API TypeScript client |
| [`@bpmnkit/ascii`](https://www.npmjs.com/package/@bpmnkit/ascii) | Render BPMN diagrams as Unicode ASCII art |
| [`@bpmnkit/profiles`](https://www.npmjs.com/package/@bpmnkit/profiles) | Shared auth, profile storage, and client factories for CLI & proxy |
| [`@bpmnkit/operate`](https://www.npmjs.com/package/@bpmnkit/operate) | Monitoring & operations frontend for Camunda clusters |

## License

[MIT](https://github.com/bpmnkit/monorepo/blob/main/LICENSE) © bpmn-sdk
