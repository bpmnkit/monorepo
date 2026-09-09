---
"@bpmnkit/docspack": patch
---

Rebuilt the pack against the corrected round-trip documentation.

The docs claimed "the parser preserves all attributes, extensions, and vendor-specific
elements", which 11 of 12 measured blueprints contradicted, and the parsing example used
`definitions.rootElements` rather than `definitions.processes`. `concepts.md`, `guides/ai.md`
and `packages/core.md` now state what survives and what is dropped, and the chunks agents
retrieve say the same.
