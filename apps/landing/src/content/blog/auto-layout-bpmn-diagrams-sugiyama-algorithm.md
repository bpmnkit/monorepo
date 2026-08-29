---
title: "Auto-layout BPMN diagrams with the Sugiyama algorithm — no coordinate math"
description: "How @bpmnkit/core lays out generated BPMN diagrams automatically, so you never have to compute x/y coordinates by hand."
pubDate: 2026-06-08
author: "BPMN Kit"
tags: ["bpmn", "layout", "core"]
---

BPMN 2.0 XML doesn't just describe *what* a process does — the `BPMNDiagram` section
also records exactly where every shape and edge sits on the canvas. If you generate a
process from code, someone has to produce those coordinates. Getting them wrong
doesn't break execution, but it does produce diagrams that overlap, cross themselves,
or render off-canvas — unreadable to the humans who eventually have to look at them.

`@bpmnkit/core` solves this with a built-in layered-graph layout pass, based on the
[Sugiyama algorithm](https://en.wikipedia.org/wiki/Layered_graph_drawing) — the same
family of algorithm used by tools like Graphviz's `dot`.

## Turning it on

```typescript
import { Bpmn, exportSvg } from "@bpmnkit/core";

const defs = Bpmn.createProcess("hello")
  .startEvent("start")
  .serviceTask("task", { name: "Hello World", taskType: "greet" })
  .endEvent("end")
  .withAutoLayout()
  .build();

const xml = Bpmn.export(defs); // ✓ BPMN 2.0 XML
const svg = exportSvg(defs);   // ✓ SVG image, zero deps
```

`.withAutoLayout()` runs before `.build()` and assigns `x`/`y`/`width`/`height` to
every shape and waypoint list to every edge. The result is a diagram that's ready to
render — with `exportSvg()`, with [`@bpmnkit/canvas`](/docs/packages/canvas),
or in Camunda Modeler / bpmn-js — without a manual layout pass.

## What the algorithm actually does

Sugiyama-style layout breaks the problem into stages:

1. **Layer assignment** — elements are assigned to horizontal layers based on their
   distance from the start event, so the diagram reads left-to-right in execution order.
2. **Crossing reduction** — within each layer, elements are ordered to minimize edge
   crossings between adjacent layers.
3. **Coordinate assignment** — final x/y positions are computed, with orthogonal edge
   routing between elements.

Because this runs deterministically on the process graph, the same process definition
always produces the same layout — useful when diagrams are regenerated in CI and
diffed for review.

## Sub-processes and branches

Layout isn't limited to a flat sequence. Gateways, `branch()` paths, and nested
sub-processes are laid out consistently, with auto-inserted join points where
branches reconverge — you get a readable diagram even for processes with several
levels of nested branching, without writing any positioning code yourself.

## Where to go next

- [Generate BPMN 2.0 diagrams programmatically in TypeScript](/blog/generate-bpmn-diagrams-programmatically-typescript)
- [Embedding a BPMN viewer in the browser](/docs/packages/canvas)
- [`@bpmnkit/core` package reference](/docs/packages/core)
