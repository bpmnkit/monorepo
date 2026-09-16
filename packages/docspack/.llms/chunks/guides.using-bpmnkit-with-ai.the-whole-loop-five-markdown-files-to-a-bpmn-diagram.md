# Using BPMN Kit with AI — The whole loop: five Markdown files to a BPMN diagram

Put the three together and the agent's job is narrow enough to be reliable:

1. **Index the team's prose** and ask it what the flow actually does — where the
   thresholds are, what runs in parallel, what happens on the unhappy path.
2. **Ask `@bpmnkit/docspack`** how to express that with this library.
3. **Ask `@bpmnkit/camunda-docspack`** whatever the engine, not the library,
   decides — gateway semantics, FEEL syntax, job types.
4. **Return a `CompactDiagram`**, not XML. About 40 lines of JSON for a diagram
   that is 200 lines of BPMN, and a model that has never written valid BPMN XML
   can still produce a valid diagram.
5. **`expand` it**, which is deterministic — layout included.

```typescript
import { Bpmn, expand } from "@bpmnkit/core";
import type { CompactDiagram } from "@bpmnkit/core";
import { answer, buildPack, indexPacks, loadPack } from "@bpmnkit/docspack";

// 1. The team's own files, indexed.
buildPack({
  source: "flow-docs",
  packDir: "flow-corpus",
  name: "order-fulfilment-corpus",
  version: "1.0.0",
  documents: ["order-fulfilment-corpus"],
  minTokens: 60,
});
const corpus = indexPacks([loadPack("flow-corpus")]);

const facts = ["when does an order need manager approval", "what runs in parallel"]
  .flatMap((q) => answer(corpus, q, { limit: 1, maxTokens: 600 }).hits)
  .map((hit) => hit.content);

// 2–4. The model reads `facts` and returns this. Nothing here is XML.
const compact: CompactDiagram = await writeDiagram(facts);

// 5. Deterministic from here on: topology, Zeebe bindings and layout.
const definitions = expand(compact);
const xml = Bpmn.export(definitions);
```

> **The compact form cannot name a gateway's default flow.** `CompactFlow`
> carries `condition` but has no field for `bpmn:default`, so a model cannot
> return one however well it understood the documentation it just read — and an
> exclusive gateway whose conditions are all false and which has no default
> deadlocks at runtime. Set it on the full model after `expand`, before export:
>
> ```typescript
> for (const process of definitions.processes) {
>   for (const element of process.flowElements) {
>     if (element.type === "exclusiveGateway" && element.id === "approved") {
>       element.default = "f9";
>     }
>   }
> }
> ```
>
> The same applies to everything else `CompactDiagram` does not model. See
> [AI Integration](/docs/guides/ai) for the full list, and use `reconcileCompact`
> rather than `expand` when you are editing a file somebody else authored.

---
Source: https://bpmnkit.com/docs/guides/using-bpmnkit-with-ai
