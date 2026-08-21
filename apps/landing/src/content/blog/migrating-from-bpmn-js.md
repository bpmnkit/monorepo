---
title: "Migrating from bpmn-js: a headless alternative"
description: "How to move BPMN rendering and generation off bpmn-js and onto a zero-dependency, isomorphic stack — what maps directly, and what changes."
pubDate: 2026-06-24
author: "BPMN Kit"
tags: ["bpmn-js", "canvas", "migration"]
---

[bpmn-js](https://github.com/bpmn-io/bpmn-js) is the default choice for rendering and
modeling BPMN in the browser, and for a lot of teams it's the right one. But if your use
case is generating diagrams from data, running in a serverless/edge function, or
server-side rendering a diagram for a PDF export, bpmn-js's DOM/browser dependency
becomes a real constraint. Here's what moving to a headless, isomorphic stack looks like.

For a feature-by-feature comparison, see [BPMN Kit vs. bpmn-js](/compare/bpmn-js). This
post is about the migration itself.

## What doesn't change

Both are working with the same underlying format — standard BPMN 2.0 XML. A diagram
authored or exported from bpmn-js parses just fine with `@bpmnkit/core`:

```typescript
import { Bpmn } from "@bpmnkit/core";

const definitions = Bpmn.parse(existingBpmnJsXml);
// full roundtrip fidelity — Zeebe extensions, custom namespaces, and
// diagram interchange info are all preserved
```

There's no lock-in on the file format either direction. You can migrate incrementally —
render existing bpmn-js-authored diagrams with `@bpmnkit/canvas` while new diagrams are
generated with `@bpmnkit/core`.

## Rendering: `bpmn-js` viewer → `@bpmnkit/canvas`

```typescript
import { BpmnCanvas } from "@bpmnkit/canvas";

const canvas = new BpmnCanvas({
  container: document.getElementById("diagram-container"),
  xml: bpmnXml,
  theme: "auto", // follows prefers-color-scheme
  fit: "contain",
});

// swap the diagram later
canvas.load(otherXml);
```

`@bpmnkit/canvas` is zero-dependency and only handles pan/zoom/rendering — no editing
by default, which is often exactly the shape you want for a read-only diagram viewer
(an audit trail, a status dashboard) where bpmn-js's full modeling toolkit is more than
you need.

## Editing: `bpmn-js` modeler → `@bpmnkit/editor`

For interactive editing, `@bpmnkit/editor` provides the canvas plus a properties panel
and drag-and-drop element creation — see [embedding a BPMN editor](/use-cases/embed-bpmn-editor)
for the full setup.

## Generating diagrams: no bpmn-js equivalent

This is the part with no direct migration path, because bpmn-js doesn't have a
generation API — it's a modeling *tool*, not a diagram *generator*. If part of your
motivation for migrating is generating diagrams programmatically (from a template,
from a database schema, from an LLM), that's what `@bpmnkit/core`'s builder replaces —
see [Generate BPMN 2.0 diagrams programmatically](/blog/generate-bpmn-diagrams-programmatically-typescript).

## Running outside the browser

If any part of the motivation is running in Node.js (a build step, a CI job, a
serverless function) — bpmn-js requires a DOM and doesn't run there without a
headless-browser shim. `@bpmnkit/core`, `@bpmnkit/canvas`'s SVG export, and
`@bpmnkit/engine` all have zero runtime dependencies and run the same way in
Node.js, Deno, Bun, or a browser.

## Where to go next

- [BPMN Kit vs. bpmn-js](/compare/bpmn-js) — full feature comparison
- [Embedding a BPMN editor](/use-cases/embed-bpmn-editor)
- [Generate BPMN 2.0 diagrams programmatically](/blog/generate-bpmn-diagrams-programmatically-typescript)
