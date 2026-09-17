# Streaming BPMN preview — render the diagram while the model is still writing it

**Status:** proposal
**Date:** 2026-09-17

## The question

When an AI generates a BPMN with BPMN Kit, the diagram only appears once the model
has finished. An LLM emits a token stream, so the shape of the process is knowable
long before the last token. Can we render it as it arrives?

**Yes.** Every piece needed already exists in this repo, and the one missing piece
is a ~100-line tolerant extractor. The measurements below were taken against the
real `@bpmnkit/core` source, not estimated.

## Where the gap actually is

The AI path is: editor panel → `POST /chat` on the proxy → a CLI adapter (`claude`,
`copilot`, `gemini`) → BPMN MCP tools → BPMN XML.

Two places serialise the result, and both do it *after* the stream is done:

- `apps/proxy/src/index.ts:574` streams adapter tokens out as `{type:"token"}`
  events. Only after `adapter.stream()` resolves does it read the MCP output file
  and emit `{type:"xml"}` (`apps/proxy/src/index.ts:589`).
- `packages/plugins/src/ai-bridge/panel.ts:754` (`finalizeAiMessage`) is what
  mounts a `BpmnCanvas` preview — it runs on finalize, with the completed XML.

So the diagram is a *terminal* event on both sides. Nothing upstream is blocking
it; the pipeline simply has no intermediate diagram to emit.

There is a second, sharper limit on the MCP path: `apps/proxy/src/adapters/claude.ts:107`
only forwards `type === "text"` blocks from complete `assistant` messages. A tool
call that builds the whole diagram (`compose_diagram`, `replace_diagram`) arrives
as one already-complete message, so even the token stream carries nothing about
the diagram — the user watches prose while the actual model is being written
invisibly.

## Why this is cheap to do

Four properties of the existing code make a streaming preview nearly free. All
four were verified by running against `packages/core/src`:

**1. Layout already ignores half-finished graphs.** `packages/core/src/layout/semantic/graph.ts:67`
drops any sequence flow whose source or target is not (yet) present. A compact
diagram truncated mid-stream lays out and exports without complaint —
measured: 2 nodes, 1 edge, 1935 bytes of valid XML from a diagram whose last two
elements had not arrived.

**2. A preview frame costs nothing.** `expand()` (which runs the layout) plus
`Bpmn.export()` measured **0.27 ms** for a 4-element process and **1.09 ms** for
40 elements. At a 100 ms throttle that is ~1% of one core.

**3. The layout does not jump as the diagram grows.** Growing a 38-element chain
one element at a time, **0 of 702** node positions moved. On the realistic case —
happy path first, exception branch appended later — exactly one step moved
anything (the two nodes before the branch shift down once when the band opens).
The preview grows rightwards instead of reshuffling, which is what makes it
watchable rather than nauseating.

**4. The canvas already has the update path.** `BpmnCanvas.loadDefinitions(defs,
{keepViewport: true})` exists for exactly this — its doc comment says "replacing
the document under a view someone is already looking at ... where re-framing on
every change would pull the canvas out from under them"
(`packages/canvas/src/types.ts:36`). `highlight(ids, "new")`
(`packages/canvas/src/canvas.ts:778`) can mark the elements that arrived in the
last frame.

## Design

### The core piece: a tolerant preview extractor

New module in core, `packages/core/src/bpmn/compact-stream.ts`, exporting one
factory:

```ts
export interface CompactStream {
  /** Feed the next chunk. Returns a diagram when the preview changed, else null. */
  push(chunk: string): BpmnDefinitions | null
}
export function createCompactStream(): CompactStream
```

It scans the accumulated text for **complete `{...}` object literals** and keeps
the ones that look like a `CompactElement` (a string `id` plus a `type` in the
known element set) or a `CompactFlow` (`id` + `from` + `to`), then expands them.

Scavenging complete objects out of arbitrary text, rather than parsing a JSON
prefix, is the decision that makes this work everywhere at once — the same
extractor handles the fallback text path's ```json block, a `replace_diagram`
tool argument, and the JavaScript body of a `compose_diagram` call, which is not
JSON at all and which the prompt currently tells the model to prefer.

A prototype of exactly this was run against a realistic 723-character
`compose_diagram` code argument, fed one character at a time:

- first renderable frame at **char 81 — 11% into the argument**
- **643** renderable prefixes, **0** errors across every truncation point
- 0.13 ms per frame

Two guards are not optional — both were found by probing, both throw today:

- A flow with `isDefault: true` whose gateway has not streamed yet throws from
  `defaultFlows` (`packages/core/src/bpmn/compact.ts`). Strip `isDefault` in
  preview frames; the final XML still carries it.
- An element whose `type` is empty or unrecognised throws
  `Unhandled BPMN element type in expand()`. Hence the known-type check rather
  than "has an id". Reuse the parser's `FLOW_ELEMENT_TYPES`
  (`packages/core/src/bpmn/bpmn-parser.ts:523`), exported for the purpose.

**The preview is advisory. The final `{type:"xml"}` event stays authoritative and
unchanged.** A frame that guesses wrong costs one wobbly render, never a wrong
artifact. That property is what keeps the risk of a text-scavenging heuristic
acceptable.

### Wiring, in three phases

**Phase 1 — preview per tool call (half a day).** The MCP server already rewrites
the output file on every mutating tool call (`saveState`,
`apps/proxy/src/mcp-server.ts:143`). Watch that file in the `/chat` handler and
emit `{type:"preview", xml}` on each write. ~15 lines, no new parsing, no adapter
changes. Gives a live preview for `add_elements` / `update_element` /
`replace_diagram` sequences — and, because it is just a file watch, the same
mechanism can back a live preview for *external* agents (Claude Code driving
`bpmn-mcp` directly), which is the broader version of the ask.

Its limit: `compose_diagram` is one call, so a from-scratch build is still a
single frame at the end. That is what Phase 2 is for.

**Phase 2 — preview per token (1–2 days).** Add `--include-partial-messages` to
the claude adapter (`apps/proxy/src/adapters/claude.ts:55`; the flag is confirmed
present in the installed CLI and emits `stream_event` envelopes carrying raw
`content_block_delta` events). Forward `input_json_delta.partial_json` on a
second callback, `onToolInput`, alongside the existing `onToken`. Feed both into
one `createCompactStream()` per request; on each non-null frame, export and emit
`{type:"preview", xml}`, throttled to ~100 ms.

Adapters without partial tool input degrade to the text path automatically — the
extractor does not care where the characters came from. `supportsMcp` already
distinguishes the adapters, so no capability plumbing is needed.

**Phase 3 — the client (half a day).** In `panel.ts`, handle `preview` in the SSE
loop (the switch at `panel.ts:86`), mount the `BpmnCanvas` on the first frame
instead of on finalize, and call `loadDefinitions(defs, {keepViewport: true})`
plus `highlight(newIds, "new")` on each subsequent one. `finalizeAiMessage`
replaces the preview with the authoritative XML — the canvas is already there, so
the last frame is a swap, not a mount.

### Where the code lives

| Piece | Home | Why |
|---|---|---|
| `createCompactStream` | `packages/core` | Beside `compact.ts`/`expand`; zero-dependency, so proxy, browser panel and CLI all reuse it |
| Output-file watch, `preview` SSE event | `apps/proxy` | The only place that owns the adapter lifecycle |
| Partial-message plumbing | `apps/proxy/src/adapters/*` | Per-CLI; opt-in per adapter |
| Canvas updates | `packages/plugins/ai-bridge` | The existing preview owner |

Nothing new is published, no new dependency is added, and no existing event type
changes meaning.

### A terminal variant, for free

`@bpmnkit/ascii`'s `renderBpmnAscii` takes the same `BpmnDefinitions` the
extractor produces. The same stream, redrawn into a terminal, gives `casen` — or
any agent working in a terminal — a live ASCII preview from the identical code
path. Worth noting as a follow-up, not part of this proposal's scope.

## Tradeoffs and what I would push back on

- **Scavenging is a heuristic.** It will occasionally pick up an object from
  prose that happens to carry `id` and a BPMN-ish `type`. The mitigation is
  structural, not defensive: the preview is throwaway. Adding schema validation
  to harden it would be spending complexity on a cost that is already zero.
- **A preview is not a plan.** Watching a wrong diagram assemble for four seconds
  may be worse than waiting four seconds for a right one. Worth an eval on real
  prompts before assuming this is a win for *quality* rather than for *latency
  perception* — it is clearly the latter.
- **Phase 1 alone may be enough.** If the answer is "users mostly do incremental
  edits, not from-scratch builds", Phase 1 delivers most of the value for a tenth
  of the work. I would ship Phase 1, measure, and only then decide on Phase 2.
- **Prompt alternative to Phase 2.** Steering the model towards `replace_diagram`
  (a CompactDiagram argument) instead of `compose_diagram` (JS) for from-scratch
  builds would make the streamed bytes clean JSON. Cheaper than partial-message
  plumbing, but it trades away the batching that `compose_diagram` exists for.
  Worth testing before committing to Phase 2.

## Verification

1. `createCompactStream` unit tests in core → verify: feeding every prefix of a
   fixture diagram (including the `isDefault`-early and truncated-type cases)
   yields only expandable frames and never throws.
2. Phase 1 → verify: a two-step `add_elements` conversation produces ≥ 2 `preview`
   events before `done`.
3. Phase 2 → verify: a from-scratch `compose_diagram` prompt produces a first
   `preview` event strictly before the adapter's stream resolves.
4. Phase 3 → verify: the canvas viewport does not re-frame between frames
   (`keepViewport`), and the final render equals the authoritative XML.
