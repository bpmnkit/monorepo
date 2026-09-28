# AI Integration — Previewing While the Model Writes — Where the frames come from

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
