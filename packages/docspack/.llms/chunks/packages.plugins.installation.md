# @bpmnkit/plugins — Installation

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

---
Source: https://bpmnkit.com/docs/packages/plugins
