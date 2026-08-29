# @bpmnkit/canvas — Overview

`@bpmnkit/canvas` is a lightweight BPMN 2.0 diagram viewer that renders to SVG.
It has no runtime dependencies and works in any browser environment.

**Features:**
- SVG rendering of all standard BPMN 2.0 element types
- Pan and zoom (mouse wheel, touch pinch, keyboard)
- Dark and light theme
- Plugin API for extending rendering and behavior
- `diagram:load` and `diagram:change` events


## Installation

```sh
pnpm add @bpmnkit/canvas
```


## Basic Usage

```typescript
import { BpmnCanvas } from "@bpmnkit/canvas";

const canvas = new BpmnCanvas({
  container: document.getElementById("canvas"),
  theme: "dark",   // "dark" | "light"
});

await canvas.loadXML(bpmnXml);
```

---
Source: https://bpmnkit.com/docs/packages/canvas
