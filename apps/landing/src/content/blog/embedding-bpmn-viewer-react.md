---
title: "Embedding a BPMN viewer in React"
description: "How to wrap @bpmnkit/canvas — a zero-dependency SVG BPMN viewer — in a React component, with correct mount/unmount and prop-change handling."
pubDate: 2026-07-01
author: "BPMN Kit"
tags: ["react", "canvas", "viewer"]
---

`@bpmnkit/canvas` is a framework-agnostic class — it mounts into a plain DOM element,
not a React component. That's a deliberate design choice (it works the same way in
React, Vue, Svelte, or no framework at all), but it means React needs a small wrapper to
manage its lifecycle correctly.

## A minimal wrapper component

```tsx
import { useEffect, useRef } from "react";
import { BpmnCanvas } from "@bpmnkit/canvas";

interface BpmnViewerProps {
  xml: string;
  theme?: "light" | "dark" | "auto";
}

export function BpmnViewer({ xml, theme = "auto" }: BpmnViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<BpmnCanvas | null>(null);

  // Mount once
  useEffect(() => {
    if (!containerRef.current) return;
    canvasRef.current = new BpmnCanvas({
      container: containerRef.current,
      xml,
      theme,
      fit: "contain",
    });
    return () => {
      canvasRef.current?.destroy();
      canvasRef.current = null;
    };
  }, []); // mount/unmount only — see below for updating xml

  // Update the diagram when `xml` changes, without remounting the canvas
  useEffect(() => {
    canvasRef.current?.load(xml);
  }, [xml]);

  return <div ref={containerRef} style={{ width: "100%", height: "100%" }} />;
}
```

The split matters: the first effect owns the canvas's lifecycle (construct once, call
`.destroy()` on unmount to clean up event listeners), and the second just calls `.load()`
whenever the `xml` prop changes, so re-renders don't tear down and rebuild the whole
canvas — panning/zoom state and any interaction plugins stay intact across an XML update.

## Sizing

`BpmnCanvas` sizes itself to its container element, so the parent `<div>` needs an
explicit size — a fixed height, a flex/grid layout, or `height: 100dvh` for a full-page
viewer. A zero-height container is the most common cause of "nothing renders."

## Theming

Pass `theme: "auto"` to follow `prefers-color-scheme`, or `"light"`/`"dark"` to control
it explicitly — useful if your app's own theme state should drive the diagram instead of
the OS setting.

## If you need editing, not just viewing

This same wrapper pattern applies to `@bpmnkit/editor` for drag-and-drop editing instead
of read-only viewing — see [embedding a BPMN editor](/use-cases/embed-bpmn-editor).

## Where to go next

- [`@bpmnkit/canvas` package reference](/docs/packages/canvas)
- [Embed a BPMN editor](/use-cases/embed-bpmn-editor)
- [BPMN Kit vs. bpmn-js](/compare/bpmn-js)
