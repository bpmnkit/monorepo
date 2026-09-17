---
"@bpmnkit/proxy": minor
"@bpmnkit/plugins": minor
---

`/chat` reports the diagram while the AI is still working. It read the MCP output file once, after the adapter stream resolved, so the diagram — the part of the answer that is worth looking at — appeared only when the model stopped talking. The MCP server rewrites that file on every mutating tool call, so the process was already on disk, several seconds early, with nothing watching it.

`watchOutputFile(dir, file, onWrite)` watches the directory (the file does not exist until the first tool call, and `watch` throws on a path that is not there) and reports each complete, changed write as a `preview` SSE event. A read that lands mid-write parses as nothing and is dropped rather than repaired: the next write carries the whole file, and the authoritative `xml` event still follows at the end of the stream. That is what makes a preview cheap — a frame that is wrong costs one render, never a wrong result.

The AI panel renders those frames into a canvas above the reply, updating it with `keepViewport` so the diagram grows in place instead of re-framing on every change, and replaces it with the authoritative render when the message finalises.
