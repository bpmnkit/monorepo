# BPMN Diagrams in Markdown — Output is deterministic

The same block and options always produce the same bytes: element ids are derived from a
hash of the block, not a counter or a clock. Pre-rendered SVGs diff cleanly, and a build
that did not change a diagram does not change its file.

---
Source: https://bpmnkit.com/docs/guides/bpmn-in-markdown
