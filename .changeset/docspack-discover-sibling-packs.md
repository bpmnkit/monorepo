---
"@bpmnkit/docspack": patch
---

Discover a vendor's second pack. The docspack spec names one pack per npm scope, `@<vendor>/docspack`, so `@bpmnkit/camunda-docspack` was published, documented and never found — every `--pack @bpmnkit/camunda-docspack` command answered `No documentation matches`, which reads as an answer rather than a failure. `discoverPacks` now reads `@<vendor>/<name>-docspack` as well: still a pure name check, still inside a scope the vendor owns, still no registry call.

`--pack` naming a package that is not installed is now an error listing the packages that are, in both the CLI and `search()`. An empty result meant "the documentation does not cover this", which is a different claim and the wrong one to hand a model.

`--pack` also narrows before the index is built rather than after. Indexing reads every chunk of every pack off disk, so a question scoped to one pack no longer pays for the others — roughly 150ms against 650ms with both packs installed.
