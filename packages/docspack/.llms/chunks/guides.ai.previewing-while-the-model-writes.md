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

### Frames are advisory

Every frame is a guess at an unfinished document. `push` never throws, drops what it cannot
place, and strips a flow's `isDefault` rather than failing when the gateway it claims has not
arrived. That is the whole bargain: a frame that guesses wrong costs one render, so the
authoritative result is whatever the model finishes with, and that is what you save or deploy.

### Where the frames come from

The local proxy (`bpmn-ai-server`) sends them on `/chat` as `preview` events, from two places:

- **The tool call being written** — argument fragments as they stream, which is the only thing
  that covers a process the model composes in a single call.
- **The MCP server's own state** — one frame per mutating tool call, once anything has been
  written. These take over as soon as they exist; they are the model's own state rather than a
  guess at an unfinished document.

A client renders `preview` as it likes and treats the `xml` event at the end of the stream as
the result. The editor's AI panel does this, and additionally outlines the elements the diagram
being edited does not have — so an edit reads as an edit rather than a rewrite. It marks
nothing when the diagram has no sequence flows yet: a process built from scratch is new all the
way through, and marking everything says no more than marking none of it.

---
Source: https://bpmnkit.com/docs/guides/ai
