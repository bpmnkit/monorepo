<div align="center">
  <a href="https://bpmnkit.com"><img src="https://bpmnkit.com/favicon.svg" width="72" height="72" alt="BPMN Kit logo"></a>
  <h1>@bpmnkit/editor</h1>
  <p>Full-featured interactive BPMN editor with undo/redo, HUD, and side-dock UI</p>

  [![npm](https://img.shields.io/npm/v/@bpmnkit/editor?style=flat-square&color=6244d7)](https://www.npmjs.com/package/@bpmnkit/editor)
  [![license](https://img.shields.io/npm/l/@bpmnkit/editor?style=flat-square)](https://github.com/bpmnkit/monorepo/blob/main/LICENSE)
  [![typescript](https://img.shields.io/badge/TypeScript-strict-6244d7?style=flat-square&logo=typescript&logoColor=white)](https://github.com/bpmnkit/monorepo)

  [Website](https://bpmnkit.com) · [Documentation](https://docs.bpmnkit.com) · [GitHub](https://github.com/bpmnkit/monorepo) · [Changelog](https://github.com/bpmnkit/monorepo/blob/main/packages/editor/CHANGELOG.md)
</div>

---

## Overview

`@bpmnkit/editor` turns the `@bpmnkit/canvas` viewer into a fully interactive editor. Drag to connect elements, inline-edit labels, resize shapes, attach boundary events, and integrate AI-assisted design — all through a composable API.

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
npm install @bpmnkit/editor @bpmnkit/canvas
```

## Quick Start

```typescript
import { BpmnEditor, initEditorHud, createSideDock } from "@bpmnkit/editor"

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
| [`@bpmnkit/core`](https://www.npmjs.com/package/@bpmnkit/core) | BPMN/DMN/Form parser, builder, layout engine |
| [`@bpmnkit/canvas`](https://www.npmjs.com/package/@bpmnkit/canvas) | Zero-dependency SVG BPMN viewer |
| [`@bpmnkit/engine`](https://www.npmjs.com/package/@bpmnkit/engine) | Lightweight BPMN process execution engine |
| [`@bpmnkit/feel`](https://www.npmjs.com/package/@bpmnkit/feel) | FEEL expression language parser & evaluator |
| [`@bpmnkit/plugins`](https://www.npmjs.com/package/@bpmnkit/plugins) | 22 composable canvas plugins |
| [`@bpmnkit/api`](https://www.npmjs.com/package/@bpmnkit/api) | Camunda 8 REST API TypeScript client |
| [`@bpmnkit/ascii`](https://www.npmjs.com/package/@bpmnkit/ascii) | Render BPMN diagrams as Unicode ASCII art |
| [`@bpmnkit/ui`](https://www.npmjs.com/package/@bpmnkit/ui) | Shared design tokens and UI components |
| [`@bpmnkit/profiles`](https://www.npmjs.com/package/@bpmnkit/profiles) | Shared auth, profile storage, and client factories for CLI & proxy |
| [`@bpmnkit/operate`](https://www.npmjs.com/package/@bpmnkit/operate) | Monitoring & operations frontend for Camunda clusters |
| [`@bpmnkit/connector-gen`](https://www.npmjs.com/package/@bpmnkit/connector-gen) | Generate connector templates from OpenAPI specs |
| [`@bpmnkit/cli`](https://www.npmjs.com/package/@bpmnkit/cli) | Camunda 8 command-line interface (casen) |
| [`@bpmnkit/proxy`](https://www.npmjs.com/package/@bpmnkit/proxy) | Local AI bridge and Camunda API proxy server |
| [`@bpmnkit/cli-sdk`](https://www.npmjs.com/package/@bpmnkit/cli-sdk) | Plugin authoring SDK for the casen CLI |
| [`@bpmnkit/create-casen-plugin`](https://www.npmjs.com/package/@bpmnkit/create-casen-plugin) | Scaffold a new casen CLI plugin in seconds |
| [`@bpmnkit/casen-report`](https://www.npmjs.com/package/@bpmnkit/casen-report) | HTML reports from Camunda 8 incident and SLA data |
| [`@bpmnkit/casen-worker-http`](https://www.npmjs.com/package/@bpmnkit/casen-worker-http) | Example HTTP worker plugin — completes jobs with live JSONPlaceholder API data |
| [`@bpmnkit/casen-worker-ai`](https://www.npmjs.com/package/@bpmnkit/casen-worker-ai) | AI task worker — classify, summarize, extract, and decide using Claude |

## License

[MIT](https://github.com/bpmnkit/monorepo/blob/main/LICENSE) © BPMN Kit — made by [u11g](https://u11g.com)

<div align="center">
  <a href="https://bpmnkit.com"><img src="https://bpmnkit.com/favicon.svg" width="32" height="32" alt="BPMN Kit"></a>
</div>
