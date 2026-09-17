---
"@bpmnkit/core": minor
"@bpmnkit/proxy": minor
---

`createCompactStream()` reads a diagram out of a model's token stream, so it can be rendered while it is still being written.

A model emits a diagram one character at a time, and the outermost `}` — the one `JSON.parse` waits for — is the last character it sends, so nothing downstream could use the seconds before it arrived. This does not parse the document: it takes complete `{...}` literals as they close and keeps the ones shaped like a `CompactElement` or a `CompactFlow`, which are the innermost objects and therefore the first to finish.

```typescript
const stream = createCompactStream({ base: currentDiagram })
const frame = stream.push(chunk) // null until the frame changes
```

That is also what makes it indifferent to what it is reading: a `replace_diagram` argument, a fenced JSON block in prose, and the body of a `compose_diagram` snippet carry the same literals, and none of them has to be valid as a whole. A single pass with a brace stack reads each character once and considers each literal once, innermost first, so a sub-process is seen after the children it reclaims from the top level.

Frames are advisory. `push` never throws, drops what it cannot place, and strips `isDefault` from a flow rather than throwing when the gateway it claims has not been written yet. On a recorded `claude` run the first renderable frame arrived 16% of the way into the tool argument, with 15 frames following.

`/chat` sends those frames as `preview` events, which closes the gap the output-file watcher leaves: a process the model composes in a single tool call writes nothing to disk until that call returns. The claude adapter asks for `--include-partial-messages` when something is listening and forwards the argument fragments of `mcp__bpmn__*` calls, keyed by content-block index so another tool's arguments are never read as a diagram. Once the MCP server has written real state, its frames take over — they are the model's own, not a guess at an unfinished document.
