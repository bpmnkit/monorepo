# @bpmnkit/core — Installation — `createCompactStream(options?)`

Reads a diagram out of a model's token stream, so it can be rendered while it is still being
written. A model emits a diagram one character at a time, and the outermost `}` — the one
`JSON.parse` waits for — is the last character it sends, so the seconds before it arrives are
unusable to everything downstream.

This does not parse the document. It takes complete `{…}` literals as they close and keeps the
ones shaped like a `CompactElement` or a `CompactFlow` — the innermost objects, and therefore
the first to finish.

```typescript
import { createCompactStream } from "@bpmnkit/core";

// `base` is the diagram being edited, so a frame shows the whole process rather
// than the fragment the model is adding to it. Omit it to build from nothing.
const stream = createCompactStream({ base: currentDiagram });

for await (const chunk of tokens) {
  const frame = stream.push(chunk); // null until the frame changes
  if (frame) canvas.loadDefinitions(frame, { keepViewport: true });
}
```

Not parsing is also what makes it indifferent to what it is reading: a tool-call argument, a
fenced JSON block in an assistant's prose, and the body of a code-mode snippet all carry the
same literals, and none of them has to be valid as a whole.

**Frames are advisory.** Every one is a guess at an unfinished document, and the caller is
expected to have an authoritative result coming. `push` never throws on input, drops what it
cannot place, and strips `isDefault` from a flow rather than failing when the gateway it claims
has not been written yet — a preview without the marker beats no preview. Use the model's
finished output, not a frame, as the thing you save or deploy.

A single pass over a brace stack reads each character once and considers each literal once,
innermost first, so a sub-process is seen after the children it reclaims from the top level.
On a recorded Claude run writing a seven-element order process, the first renderable frame
arrived 16% of the way into the tool argument, with 15 frames following.

---
Source: https://bpmnkit.com/docs/packages/core
