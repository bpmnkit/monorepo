<div align="center">
  <img src="https://raw.githubusercontent.com/bpmnkit/monorepo/main/doc/logos/2026.svg" width="72" height="72" alt="BPMN Kit logo">
  <h1>@bpmnkit/plugins</h1>
  <p>22 composable canvas plugins — minimap, AI chat, process simulation, storage, and more</p>

  [![npm](https://img.shields.io/npm/v/@bpmnkit/plugins?style=flat-square&color=6244d7)](https://www.npmjs.com/package/@bpmnkit/plugins)
  [![license](https://img.shields.io/npm/l/@bpmnkit/plugins?style=flat-square)](https://github.com/bpmnkit/monorepo/blob/main/LICENSE)
  [![typescript](https://img.shields.io/badge/TypeScript-strict-6244d7?style=flat-square&logo=typescript&logoColor=white)](https://github.com/bpmnkit/monorepo)

  [Website](https://bpmnkit.com) · [Documentation](https://docs.bpmnkit.com) · [GitHub](https://github.com/bpmnkit/monorepo) · [Changelog](https://github.com/bpmnkit/monorepo/blob/main/packages/plugins/CHANGELOG.md)
</div>

---

## Overview

`@bpmnkit/plugins` is a single package containing 22 ready-made `CanvasPlugin` add-ons for `@bpmnkit/canvas` and `@bpmnkit/editor`. Each plugin is imported individually via subpath exports so you only bundle what you use.

## Installation

```sh
npm install @bpmnkit/plugins
```

## Plugins

### Visualization

| Subpath | Factory | Description |
|---------|---------|-------------|
| `/minimap` | `createMinimapPlugin()` | Thumbnail navigation minimap |
| `/watermark` | `createWatermarkPlugin(text)` | Corner watermark overlay |
| `/ascii-view` | `createAsciiViewPlugin()` | Toggle ASCII art rendering |
| `/zoom-controls` | `createZoomControlsPlugin()` | On-canvas +/− zoom buttons |

### File Management

| Subpath | Factory | Description |
|---------|---------|-------------|
| `/tabs` | `createTabsPlugin(options)` | Multi-file tab bar with welcome screen |
| `/storage` | `createStoragePlugin(options)` | IndexedDB workspaces/projects/files with auto-save |
| `/storage-tabs-bridge` | `createStorageTabsBridge(options)` | Wire tabs + storage + main menu together |

### Editing

| Subpath | Factory | Description |
|---------|---------|-------------|
| `/command-palette` | `createCommandPalettePlugin()` | ⌘K command palette |
| `/command-palette-editor` | `createCommandPaletteEditorPlugin()` | Editor-specific commands |
| `/history` | `createHistoryPlugin()` | Visual undo/redo history panel |
| `/config-panel` | `createConfigPanelPlugin(options)` | Properties panel for selected elements |
| `/config-panel-bpmn` | `createConfigPanelBpmnPlugin(options)` | BPMN-specific properties panel |

### DMN & Forms

| Subpath | Factory | Description |
|---------|---------|-------------|
| `/dmn-editor` | — | Embedded DMN decision table editor |
| `/dmn-viewer` | — | Read-only DMN viewer |
| `/form-editor` | — | Camunda Form schema editor |
| `/form-viewer` | — | Read-only form renderer |
| `/feel-playground` | — | Interactive FEEL expression tester |

### Process Simulation

| Subpath | Factory | Description |
|---------|---------|-------------|
| `/process-runner` | `createProcessRunnerPlugin(options)` | Run BPMN instances with play/step/stop UI |
| `/token-highlight` | `createTokenHighlightPlugin()` | Highlight active/visited elements during execution |
| `/optimize` | `createOptimizePlugin()` | Show optimizer findings overlay |

### AI & Navigation

| Subpath | Factory | Description |
|---------|---------|-------------|
| `/ai-bridge` | `createAiBridgePlugin(options)` | AI chat panel with diagram apply/checkpoint |
| `/element-docs` | `createElementDocsPlugin(options)` | Built-in BPMN element reference docs |
| `/main-menu` | `createMainMenuPlugin(options)` | File/Edit top-level menu |

## Usage Examples

### Minimap

```typescript
import { BpmnCanvas } from "@bpmnkit/canvas"
import { createMinimapPlugin } from "@bpmnkit/plugins/minimap"

const canvas = new BpmnCanvas({
  container: document.getElementById("canvas")!,
  plugins: [createMinimapPlugin()],
})
```

### Storage + Tabs

```typescript
import { createStoragePlugin } from "@bpmnkit/plugins/storage"
import { createTabsPlugin } from "@bpmnkit/plugins/tabs"
import { createStorageTabsBridge } from "@bpmnkit/plugins/storage-tabs-bridge"

const storage = createStoragePlugin({ editor })
const tabs = createTabsPlugin({ editor })
const bridge = createStorageTabsBridge({ storage, tabs, mainMenu })
```

### Process Simulation

```typescript
import { Engine } from "@bpmnkit/engine"
import { createTokenHighlightPlugin } from "@bpmnkit/plugins/token-highlight"
import { createProcessRunnerPlugin } from "@bpmnkit/plugins/process-runner"

const engine = new Engine()
const tokenHighlight = createTokenHighlightPlugin()
const processRunner = createProcessRunnerPlugin({ engine, tokenHighlight })

const canvas = new BpmnCanvas({
  container,
  plugins: [tokenHighlight, processRunner],
})
```

### AI Chat Panel

```typescript
import { createAiBridgePlugin } from "@bpmnkit/plugins/ai-bridge"

const ai = createAiBridgePlugin({
  serverUrl: "http://localhost:3033",
  container: dock.aiPane,
  onOpen: () => dock.expand(),
})
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
| [`@bpmnkit/api`](https://www.npmjs.com/package/@bpmnkit/api) | Camunda 8 REST API TypeScript client |
| [`@bpmnkit/ascii`](https://www.npmjs.com/package/@bpmnkit/ascii) | Render BPMN diagrams as Unicode ASCII art |
| [`@bpmnkit/ui`](https://www.npmjs.com/package/@bpmnkit/ui) | Shared design tokens and UI components |
| [`@bpmnkit/profiles`](https://www.npmjs.com/package/@bpmnkit/profiles) | Shared auth, profile storage, and client factories for CLI & proxy |
| [`@bpmnkit/operate`](https://www.npmjs.com/package/@bpmnkit/operate) | Monitoring & operations frontend for Camunda clusters |
| [`@bpmnkit/connector-gen`](https://www.npmjs.com/package/@bpmnkit/connector-gen) | Generate connector templates from OpenAPI specs |
| [`@bpmnkit/cli`](https://www.npmjs.com/package/@bpmnkit/cli) | Camunda 8 command-line interface (casen) |
| [`@bpmnkit/proxy`](https://www.npmjs.com/package/@bpmnkit/proxy) | Local AI bridge and Camunda API proxy server |

## License

[MIT](https://github.com/bpmnkit/monorepo/blob/main/LICENSE) © BPMN Kit — made by [u11g](https://u11g.com)
