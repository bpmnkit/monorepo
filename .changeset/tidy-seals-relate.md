---
"@bpmnkit/editor": minor
"@bpmnkit/canvas": minor
---

Editor edits now describe themselves, so the same edit can be replayed elsewhere.

- `diagram:op` fires alongside `diagram:change` for every edit, carrying an
  `EditorOp` — a few hundred bytes where the document is hundreds of kilobytes.
  Undo, redo and `loadDefinitions` replace the document rather than advance it,
  and stay silent.
- `applyOp(defs, op)` performs an op. It is also how the editor performs its own
  edits, so a local edit and its replay cannot drift.
- Element ids travel in the op as a seed: `createIdFactory(seed)` mints the same
  sequence on every machine, and the modeling functions take an optional
  `IdFactory`. The same op yields byte-identical XML wherever it runs.
- `getViewport()` / `setViewport()` are public on `BpmnCanvas` and `BpmnEditor`,
  so a view survives being handed from one to the other without a re-fit.
