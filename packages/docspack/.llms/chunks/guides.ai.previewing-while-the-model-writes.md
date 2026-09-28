# AI Integration — Previewing While the Model Writes

A diagram is visual, and a model takes seconds to write one. Waiting for the last token to
show anything means the user watches prose scroll past while the only interesting part of the
answer is already most of the way written.

Nothing downstream can use a half-written document, though — `JSON.parse` wants the closing
brace, and the outermost one is the very last character a tool call sends.
`createCompactStream` sidesteps that by not parsing the document at all. It takes complete
`{…}` literals as they close and keeps the ones shaped like an element or a flow, which are
the innermost objects and so the first to finish:

```typescript
import { createCompactStream } from "@bpmnkit/core";

const stream = createCompactStream({ base: currentDiagram });

for await (const chunk of tokens) {
  const frame = stream.push(chunk); // null until the frame changes
  if (frame) canvas.loadDefinitions(frame, { keepViewport: true });
}
```

Pass `base` when the model is editing something. It streams only what it is adding, so without
the diagram it started from a frame is a disconnected fragment rather than the process with the
fragment in it.

`keepViewport` matters as much as the frames do: without it the canvas re-frames the diagram on
every update and pulls the view out from under whoever is watching. With it, the process grows
in place — the layout is stable enough for that, because appending to a diagram does not move
what is already placed.

---
Source: https://bpmnkit.com/docs/guides/ai
