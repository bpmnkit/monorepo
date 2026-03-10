<div align="center">
  <img src="https://raw.githubusercontent.com/bpmn-sdk/monorepo/main/doc/logos/logo-2-gateway.svg" width="72" height="72" alt="BPMN SDK logo">
  <h1>@bpmn-sdk/plugins</h1>
  <p>22 composable canvas plugins — minimap, AI chat, process simulation, storage, and more</p>

  [![npm](https://img.shields.io/npm/v/@bpmn-sdk/plugins?style=flat-square&color=6244d7)](https://www.npmjs.com/package/@bpmn-sdk/plugins)
  [![license](https://img.shields.io/npm/l/@bpmn-sdk/plugins?style=flat-square)](https://github.com/bpmn-sdk/monorepo/blob/main/LICENSE)
  [![typescript](https://img.shields.io/badge/TypeScript-strict-6244d7?style=flat-square&logo=typescript&logoColor=white)](https://github.com/bpmn-sdk/monorepo)

  [Website](https://bpmnsdk.u11g.com) · [Documentation](https://bpmnsdkdocs.u11g.com) · [GitHub](https://github.com/bpmn-sdk/monorepo) · [Changelog](https://github.com/bpmn-sdk/monorepo/blob/main/packages/plugins/CHANGELOG.md)
</div>

---

## Overview

`@bpmn-sdk/plugins` is a single package containing 22 ready-made `CanvasPlugin` add-ons for `@bpmn-sdk/canvas` and `@bpmn-sdk/editor`. Each plugin is imported individually via subpath exports so you only bundle what you use.

## Installation

```sh
npm install @bpmn-sdk/plugins
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
import { BpmnCanvas } from "@bpmn-sdk/canvas"
import { createMinimapPlugin } from "@bpmn-sdk/plugins/minimap"

const canvas = new BpmnCanvas({
  container: document.getElementById("canvas")!,
  plugins: [createMinimapPlugin()],
})
```

### Storage + Tabs

```typescript
import { createStoragePlugin } from "@bpmn-sdk/plugins/storage"
import { createTabsPlugin } from "@bpmn-sdk/plugins/tabs"
import { createStorageTabsBridge } from "@bpmn-sdk/plugins/storage-tabs-bridge"

const storage = createStoragePlugin({ editor })
const tabs = createTabsPlugin({ editor })
const bridge = createStorageTabsBridge({ storage, tabs, mainMenu })
```

### Process Simulation

```typescript
import { Engine } from "@bpmn-sdk/engine"
import { createTokenHighlightPlugin } from "@bpmn-sdk/plugins/token-highlight"
import { createProcessRunnerPlugin } from "@bpmn-sdk/plugins/process-runner"

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
import { createAiBridgePlugin } from "@bpmn-sdk/plugins/ai-bridge"

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
| [`@bpmn-sdk/core`](https://www.npmjs.com/package/@bpmn-sdk/core) | BPMN/DMN/Form parser, builder, layout engine |
| [`@bpmn-sdk/canvas`](https://www.npmjs.com/package/@bpmn-sdk/canvas) | Zero-dependency SVG BPMN viewer |
| [`@bpmn-sdk/editor`](https://www.npmjs.com/package/@bpmn-sdk/editor) | Full-featured interactive BPMN editor |
| [`@bpmn-sdk/engine`](https://www.npmjs.com/package/@bpmn-sdk/engine) | Lightweight BPMN process execution engine |
| [`@bpmn-sdk/feel`](https://www.npmjs.com/package/@bpmn-sdk/feel) | FEEL expression language parser & evaluator |
| [`@bpmn-sdk/api`](https://www.npmjs.com/package/@bpmn-sdk/api) | Camunda 8 REST API TypeScript client |
| [`@bpmn-sdk/ascii`](https://www.npmjs.com/package/@bpmn-sdk/ascii) | Render BPMN diagrams as Unicode ASCII art |

## License

[MIT](https://github.com/bpmn-sdk/monorepo/blob/main/LICENSE) © bpmn-sdk
