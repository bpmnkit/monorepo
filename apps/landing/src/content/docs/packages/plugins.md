---
title: "@bpmnkit/plugins"
description: Thirty-four composable plugins for the BPMN canvas and editor — minimap, linting, simulation, AI bridge, storage and more.
sidebar:
  order: 4
---

## Overview

`@bpmnkit/plugins` is the capability layer above `@bpmnkit/canvas` and `@bpmnkit/editor`. The
canvas draws a diagram and exposes a `CanvasApi`; a plugin is anything that takes that API and
adds something — an overlay, a panel, a keyboard mode, a side effect on save.

Every plugin ships behind **its own entry point**, so a viewer that wants a minimap and
nothing else pays for a minimap and nothing else:

```typescript
import { createMinimapPlugin } from "@bpmnkit/plugins/minimap";
```

There is deliberately **no root export**. `import … from "@bpmnkit/plugins"` does not resolve,
because a barrel would pull all thirty-four into every bundle that wanted one.

## Installation

```sh
npm install @bpmnkit/plugins @bpmnkit/canvas
```

## Using a plugin

Most plugins are a factory you call and hand to the canvas:

```typescript
import { BpmnCanvas } from "@bpmnkit/canvas";
import { createMinimapPlugin } from "@bpmnkit/plugins/minimap";
import { createZoomControlsPlugin } from "@bpmnkit/plugins/zoom-controls";

const canvas = new BpmnCanvas({
  container: document.getElementById("app")!,
  xml,
  plugins: [createMinimapPlugin(), createZoomControlsPlugin()],
});
```

Plugins compose: they are independent, order-insensitive unless they say otherwise, and each
one cleans up after itself when the canvas is destroyed.

## What is available

**Navigation and view**

| Entry point | Export | What it adds |
|---|---|---|
| `minimap` | `createMinimapPlugin` | Overview panel; click to pan |
| `zoom-controls` | `createZoomControlsPlugin` | Zoom in/out/fit buttons |
| `flow-navigation` | `createFlowNavigationPlugin` | Keyboard cursor that walks the sequence flows |
| `model-navigation` | `createModelNavigationPlugin` | Drill into sub-processes and call activities |
| `presentation` | `createPresentationPlugin` | Step through a process as slides |
| `story-view` | `createStoryViewPlugin` | The process as readable prose cards |
| `ascii-view` | `createAsciiViewPlugin` | The diagram as text, via `@bpmnkit/ascii` |
| `watermark` | `createWatermarkPlugin` | A mark over the canvas |

**Editing**

| Entry point | Export | What it adds |
|---|---|---|
| `config-panel` | `createConfigPanelPlugin` | Property panel shell |
| `config-panel-bpmn` | `createConfigPanelBpmnPlugin` | The BPMN property editors themselves |
| `command-palette` | `createCommandPalettePlugin` | ⌘K palette for a viewer |
| `command-palette-editor` | `createCommandPaletteEditorPlugin` | The editor's own commands |
| `main-menu` | `createMainMenuPlugin` | Menu bar |
| `tabs` | `createTabsPlugin`, `InMemoryFileResolver` | Multi-file tabs |
| `history` | `saveCheckpoint`, `listCheckpoints`, `createHistoryPanel` | Named checkpoints |
| `storage` | `createStoragePlugin` | Persistence, with a host-supplied backend |
| `storage-tabs-bridge` | `createStorageTabsBridge` | Wires those two together |
| `element-docs` | `createElementDocsPlugin` | Inline BPMN reference for the selected element |

**Correctness**

| Entry point | Export | What it adds |
|---|---|---|
| `lint` | `createLintPlugin` | Findings on the canvas |
| `optimize` | `createOptimizePlugin` | The `@bpmnkit/core` optimizer, on the diagram |
| `pattern-advisor` | `createPatternAdvisorPlugin` | Fifteen pattern rules, with fixes |
| `variable-flow` | `createVariableFlowPlugin` | Producers and consumers per variable |
| `diff` | `createBpmnDiff` | Visual diff of two models |

**Execution**

| Entry point | Export | What it adds |
|---|---|---|
| `process-runner` | `createProcessRunnerPlugin` | Simulate, step, chaos mode, scenario tests |
| `token-highlight` | `createTokenHighlightPlugin` | Token positions on the canvas |
| `live-mode` | `createLiveModePlugin` | Auto-deploy and live instance overlay |
| `deploy` | `createDeployPlugin` | Deploy to a cluster, guarded by the optimizer |

**DMN, forms and FEEL**

| Entry point | Export | What it adds |
|---|---|---|
| `dmn-viewer` | `DmnViewer`, `injectDmnViewerStyles` | Render a decision table |
| `dmn-editor` | `DmnEditor` | Edit one |
| `form-viewer` | `FormViewer`, `injectFormViewerStyles` | Render a Camunda Form |
| `form-editor` | `FormEditor` | Edit one |
| `feel-playground` | `createFeelPlaygroundPlugin`, `buildFeelPlaygroundPanel` | Evaluate FEEL against live variables |

**Integration**

| Entry point | Export | What it adds |
|---|---|---|
| `ai-bridge` | `createAiBridgePlugin` | Natural-language edits over the compact model |
| `connector-catalog` | `createConnectorCatalogPlugin` | Browse and apply `@bpmnkit/connectors` |

## Styles

Plugins that render their own UI export their CSS as a string and an injector — for example
`FORM_VIEWER_CSS` and `injectFormViewerStyles` from `form-viewer`. The injectors are
id-guarded, so calling one twice is free, and a host that would rather ship the CSS itself can
take the string instead.

Brand colours come from `@bpmnkit/ui` tokens with hex fallbacks, so a plugin looks right
standalone and themes correctly inside an app that sets them.

## Stability

`@bpmnkit/plugins` carries the [1.0 stability promise](/docs/getting-started/stability): the
entry points listed above, and the exports and option types they name, will not change shape
without a major version.

Two clarifications, because a plugin package is where the edges are:

- **Adding a plugin is a minor.** A new entry point breaks nobody.
- **Rendered DOM and class names are not API.** How a panel is laid out, which elements it
  builds, and the class names inside it are presentation. Style through the documented CSS
  custom properties rather than by reaching into the markup.
