---
title: "@bpmn-sdk/canvas"
description: Zero-dependency SVG BPMN viewer with pan/zoom, dark/light theme, and plugin API.
---

## Overview

`@bpmn-sdk/canvas` is a lightweight BPMN 2.0 diagram viewer that renders to SVG.
It has no runtime dependencies and works in any browser environment.

**Features:**
- SVG rendering of all standard BPMN 2.0 element types
- Pan and zoom (mouse wheel, touch pinch, keyboard)
- Dark and light theme
- Plugin API for extending rendering and behavior
- `diagram:load` and `diagram:change` events

## Installation

```sh
pnpm add @bpmn-sdk/canvas
```

## Basic Usage

```typescript
import { BpmnCanvas } from "@bpmn-sdk/canvas";

const canvas = new BpmnCanvas({
  container: document.getElementById("canvas"),
  theme: "dark",   // "dark" | "light"
});

await canvas.loadXML(bpmnXml);
```

## Options

```typescript
type CanvasOptions = {
  container: HTMLElement;
  theme?: "dark" | "light";
  plugins?: CanvasPlugin[];
};
```

## API

| Method | Description |
|---|---|
| `canvas.loadXML(xml)` | Load and render a BPMN XML string |
| `canvas.getXML()` | Return the currently loaded XML |
| `canvas.setTheme(theme)` | Switch between dark and light theme |
| `canvas.on(event, handler)` | Subscribe to canvas events |
| `canvas.off(event, handler)` | Unsubscribe a handler |
| `canvas.destroy()` | Clean up the canvas and remove from DOM |

## Events

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
import { BpmnCanvas } from "@bpmn-sdk/canvas";
import { createMinimapPlugin } from "@bpmn-sdk/canvas-plugin-minimap";
import { createZoomControlsPlugin } from "@bpmn-sdk/canvas-plugin-zoom-controls";

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
| `@bpmn-sdk/canvas-plugin-minimap` | Overview minimap |
| `@bpmn-sdk/canvas-plugin-zoom-controls` | Zoom in/out buttons |
| `@bpmn-sdk/canvas-plugin-command-palette` | Keyboard command palette |
| `@bpmn-sdk/canvas-plugin-storage` | File persistence (IndexedDB) |
| `@bpmn-sdk/canvas-plugin-tabs` | Multi-file tab bar |
| `@bpmn-sdk/canvas-plugin-process-runner` | In-browser simulation controls |
| `@bpmn-sdk/canvas-plugin-token-highlight` | Visual token tracking |
| `@bpmn-sdk/canvas-plugin-ai-bridge` | AI chat integration |
