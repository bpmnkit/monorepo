---
"@bpmnkit/docspack": patch
---

Index the new Stability and Versioning page.

`docs/getting-started/stability` states the contract each package takes on at 1.0.0: that
public API is what the `exports` entry points export minus `@internal`, how type-level changes
are graded in each direction, and — the part no general semver policy covers — that a change to
generated BPMN is breaking when it moves `semanticHash` and not when it only moves the bytes.

The pack grows from 191 to 198 chunks.
