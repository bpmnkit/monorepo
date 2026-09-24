---
"@bpmnkit/core": patch
---

Keep the attributes of `<documentation>` (`id`, `textFormat`) on round trip, in a new optional `documentationAttributes` field next to `documentation`. This was the last content loss on the OMG MIWG reference models. `semanticHash` of a model whose documentation carries attributes changes accordingly.
