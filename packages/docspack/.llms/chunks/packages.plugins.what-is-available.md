# @bpmnkit/plugins — What is available

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

---
Source: https://bpmnkit.com/docs/packages/plugins
