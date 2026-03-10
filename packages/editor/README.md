<div align="center">
  <img src="https://raw.githubusercontent.com/bpmn-sdk/monorepo/main/doc/logos/logo-2-gateway.svg" width="72" height="72" alt="BPMN SDK logo">
  <h1>@bpmn-sdk/editor</h1>
  <p>Full-featured interactive BPMN editor with undo/redo, HUD, and side-dock UI</p>

  [![npm](https://img.shields.io/npm/v/@bpmn-sdk/editor?style=flat-square&color=6244d7)](https://www.npmjs.com/package/@bpmn-sdk/editor)
  [![license](https://img.shields.io/npm/l/@bpmn-sdk/editor?style=flat-square)](https://github.com/bpmn-sdk/monorepo/blob/main/LICENSE)
  [![typescript](https://img.shields.io/badge/TypeScript-strict-6244d7?style=flat-square&logo=typescript&logoColor=white)](https://github.com/bpmn-sdk/monorepo)

  [Website](https://bpmnsdk.u11g.com) · [Documentation](https://bpmnsdkdocs.u11g.com) · [GitHub](https://github.com/bpmn-sdk/monorepo) · [Changelog](https://github.com/bpmn-sdk/monorepo/blob/main/packages/editor/CHANGELOG.md)
</div>

---

## Overview

`@bpmn-sdk/editor` turns the `@bpmn-sdk/canvas` viewer into a fully interactive editor. Drag to connect elements, inline-edit labels, resize shapes, attach boundary events, and integrate AI-assisted design — all through a composable API.

## Features

- **40+ element types** — all BPMN 2.0 tasks, events, gateways, sub-processes
- **Drag-to-connect** — draw sequence flows with automatic waypoint routing
- **Resize & move** — multi-select, group move, constrained resize
- **Label editing** — inline text editor with multi-line support
- **Undo/redo** — full command history with keyboard shortcuts
- **Copy/paste** — multi-element clipboard with offset paste
- **Boundary events** — attach and detach boundary events interactively
- **HUD toolbar** — customisable palette with shape categories
- **Side dock** — resizable right sidebar with Properties, AI chat, and Docs tabs
- **Theme persistence** — auto read/write `localStorage` with `persistTheme`

## Installation

```sh
npm install @bpmn-sdk/editor @bpmn-sdk/canvas
```

## Quick Start

```typescript
import { BpmnEditor, initEditorHud, createSideDock } from "@bpmn-sdk/editor"

// Full editor (viewer + editing interactions)
const editor = new BpmnEditor({
  container: document.getElementById("editor")!,
  theme: "dark",
  persistTheme: true,
  plugins: [],
})

// Toolbar HUD (palette, zoom controls, etc.)
initEditorHud(editor, {
  container: document.getElementById("hud")!,
})

// Sidebar with Properties + AI tabs
const dock = createSideDock(document.body)
editor.loadXML(bpmnXml)
```

## API Reference

### `BpmnEditor`

Extends `BpmnCanvas`. Adds all editing interactions.

```typescript
interface EditorOptions extends CanvasOptions {
  persistTheme?: boolean  // auto-save theme to localStorage
}
```

### `initEditorHud(editor, options)`

Mounts the toolbar HUD into a container.

```typescript
interface HudOptions {
  container: HTMLElement
  optimizeButton?: HTMLElement  // inject into action bar
  aiButton?: HTMLElement        // inject into action bar
}
```

### `createSideDock(container)` → `SideDock`

Creates the right-side collapsible dock.

```typescript
interface SideDock {
  el: HTMLElement
  propertiesPane: HTMLDivElement
  aiPane: HTMLDivElement
  docsPane: HTMLDivElement
  switchTab(tab: "properties" | "ai" | "docs" | "history" | "play"): void
  expand(): void
  collapse(): void
  collapsed: boolean
  setDiagramInfo(processName: string, fileName: string): void
}
```

---

## Related Packages

| Package | Description |
|---------|-------------|
| [`@bpmn-sdk/core`](https://www.npmjs.com/package/@bpmn-sdk/core) | BPMN/DMN/Form parser, builder, layout engine |
| [`@bpmn-sdk/canvas`](https://www.npmjs.com/package/@bpmn-sdk/canvas) | Zero-dependency SVG BPMN viewer |
| [`@bpmn-sdk/engine`](https://www.npmjs.com/package/@bpmn-sdk/engine) | Lightweight BPMN process execution engine |
| [`@bpmn-sdk/feel`](https://www.npmjs.com/package/@bpmn-sdk/feel) | FEEL expression language parser & evaluator |
| [`@bpmn-sdk/plugins`](https://www.npmjs.com/package/@bpmn-sdk/plugins) | 22 composable canvas plugins |
| [`@bpmn-sdk/api`](https://www.npmjs.com/package/@bpmn-sdk/api) | Camunda 8 REST API TypeScript client |
| [`@bpmn-sdk/ascii`](https://www.npmjs.com/package/@bpmn-sdk/ascii) | Render BPMN diagrams as Unicode ASCII art |

## License

[MIT](https://github.com/bpmn-sdk/monorepo/blob/main/LICENSE) © bpmn-sdk
