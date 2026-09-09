---
"@bpmnkit/proxy": minor
"@bpmnkit/plugins": minor
---

The AI edit path applies operations to the full model instead of a compact projection.

- `proxy`: `POST /improve` accepts `{ xml }` — the whole model — and applies the generated
  operations to it, so pools, lanes, data wiring and `ioMapping` detail survive an edit. The
  prompt still receives the compact view, which is what it is for. The older `{ context }`
  shape keeps working for clients that have not been updated, with a warning naming what it
  cannot describe. Operations that reference a missing element are reported over the stream as
  a `problems` event rather than skipped in silence.
- `plugins`: the AI bridge panel sends the exported XML rather than a compact diagram. It
  therefore needs a proxy that understands `{ xml }`.
