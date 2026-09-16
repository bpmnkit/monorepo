# Using BPMN Kit with AI — Runnable examples

Three scripts in [`apps/examples/src/ai`](https://github.com/bpmnkit/monorepo/tree/main/apps/examples/src/ai)
do exactly the above. They need no API key and no network — the whole set runs
in about three seconds:

```sh
pnpm --filter @bpmnkit/examples ai:ask     # ask both packs, from the library
pnpm --filter @bpmnkit/examples ai:index   # 5 Markdown files → an askable corpus
pnpm --filter @bpmnkit/examples ai:bpmn    # corpus → CompactDiagram → .bpmn
```

`ai:bpmn` writes `output/order-fulfilment.bpmn`: 18 elements, 20 sequence flows,
laid out, with the gateway defaults set.


## Keeping it fast

| What | Cost | Why |
| --- | --- | --- |
| `ask` scoped with `--pack @bpmnkit/docspack` | ~150ms | indexes one pack |
| `ask` across both packs | ~650ms | indexes both, 1,200+ chunks |
| `indexPacks` once, then `answer` per question | ~0ms per question | the index is the expensive part |
| Building a 5-document corpus | ~9ms | no model, no network |

Reading chunks off disk dominates, and a fresh `npx bpmnkit-docs ask` pays it on
every question. Scope with `--pack` when you know which pack answers; use the
library and hold the index when you are asking more than a handful of questions.

---
Source: https://bpmnkit.com/docs/guides/using-bpmnkit-with-ai
