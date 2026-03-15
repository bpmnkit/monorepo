---
title: "@bpmnkit/editor"
description: Full BPMN editor — canvas, properties panel, AI bridge, and storage.
---

## Overview

`@bpmnkit/editor` bundles everything needed to embed a full-featured BPMN editor
into any web application:

- **Canvas** — SVG viewer with pan/zoom
- **Properties panel** — edit element properties inline
- **AI bridge** — chat panel connected to a local AI server
- **Storage** — auto-save to IndexedDB with project/file management
- **HUD** — toolbar with undo/redo, zoom, optimize, and AI buttons
- **Side dock** — collapsible right panel (properties + AI tabs)

## Installation

```sh
pnpm add @bpmnkit/editor
```

## Basic Setup

```typescript
import { BpmnEditor, initEditorHud } from "@bpmnkit/editor";

// Create the editor
const editor = new BpmnEditor({
  container: document.getElementById("editor"),
  theme: "dark",
  persistTheme: true,   // read/write "bpmn-theme" in localStorage
});

// Initialize the HUD (toolbar overlay)
const hud = initEditorHud(editor);

// Load a diagram
await editor.loadXML(bpmnXml);
```

## With Side Dock

The side dock provides a collapsible properties + AI panel:

```typescript
import { BpmnEditor, initEditorHud, createSideDock } from "@bpmnkit/editor";

const editor = new BpmnEditor({
  container: document.getElementById("editor"),
});

const dock = createSideDock();
document.body.appendChild(dock.el);

const hud = initEditorHud(editor, {
  aiButton: dock.aiPane.button,
});
```

## HUD Options

```typescript
type HudOptions = {
  optimizeButton?: HTMLElement;   // inject an external "Optimize" button
  aiButton?: HTMLElement;         // inject an external "AI" button
};
```

## EditorOptions

```typescript
type EditorOptions = {
  container: HTMLElement;
  theme?: "dark" | "light";
  persistTheme?: boolean;         // auto-save theme to localStorage
  plugins?: CanvasPlugin[];
};
```

## SideDock API

```typescript
type SideDock = {
  el: HTMLElement;
  propertiesPane: HTMLElement;
  aiPane: { button: HTMLElement; el: HTMLElement };
  switchTab(tab: "properties" | "ai"): void;
  expand(): void;
  collapse(): void;
  collapsed: boolean;
  showPanel(): void;
  hidePanel(): void;
  setDiagramInfo(processName: string, fileName: string): void;
};
```

## Full Editor with All Plugins

The landing page editor uses the `createStorageTabsBridge` plugin which wires together
tabs, storage, AI, and command palette in one call:

```typescript
import { createStorageTabsBridge } from "@bpmnkit/canvas-plugin-storage-tabs-bridge";
import { BpmnEditor, initEditorHud, createSideDock } from "@bpmnkit/editor";

const editor = new BpmnEditor({ container });
const dock = createSideDock();

const bridge = createStorageTabsBridge({
  mainMenu: menuPlugin,
  resolver: fileResolver,
  enableFileImport: true,
  getExamples: (tabsApi) => [
    {
      label: "Approval Flow",
      load: () => tabsApi.openTab({ xml: approvalFlowXml }),
    },
  ],
});

document.body.appendChild(dock.el);
const hud = initEditorHud(editor, { aiButton: dock.aiPane.button });
```
