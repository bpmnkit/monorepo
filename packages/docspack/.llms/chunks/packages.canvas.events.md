# @bpmnkit/canvas — Events

```typescript
canvas.on("diagram:load", () => {
  console.log("Diagram loaded");
});

canvas.on("diagram:change", () => {
  console.log("Diagram modified");
});
```


## Plugins

The canvas accepts an array of plugins that can extend its behavior:

```typescript
import { BpmnCanvas } from "@bpmnkit/canvas";
import { createMinimapPlugin } from "@bpmnkit/canvas-plugin-minimap";
import { createZoomControlsPlugin } from "@bpmnkit/canvas-plugin-zoom-controls";

const canvas = new BpmnCanvas({
  container: document.getElementById("canvas"),
  plugins: [
    createMinimapPlugin(),
    createZoomControlsPlugin(),
  ],
});
```

### Plugin interface

```typescript
type CanvasPlugin = {
  name: string;
  install(api: CanvasApi): void;
  uninstall?(): void;
};
```

### Available plugins

| Package | Description |
|---|---|
| `@bpmnkit/canvas-plugin-minimap` | Overview minimap |
| `@bpmnkit/canvas-plugin-zoom-controls` | Zoom in/out buttons |
| `@bpmnkit/canvas-plugin-command-palette` | Keyboard command palette |
| `@bpmnkit/canvas-plugin-storage` | File persistence (IndexedDB) |
| `@bpmnkit/canvas-plugin-tabs` | Multi-file tab bar |
| `@bpmnkit/canvas-plugin-process-runner` | In-browser simulation controls |
| `@bpmnkit/canvas-plugin-token-highlight` | Visual token tracking |
| `@bpmnkit/canvas-plugin-ai-bridge` | AI chat integration |

---
Source: https://docs.bpmnkit.com/packages/canvas/
