# @bpmnkit/core — Installation — Joins: inferred by default, or declared

Where several branches of one gateway reach the same element, `build()` inserts a matching
join gateway for you. That is a help when you are reading the chain you just wrote, and a trap
for generated code, which cannot see the element it did not emit.

```typescript
const defs = builder.build({ explicitJoins: true });
// Error: Inferred join gateways: gw_join. Declare them with .connectTo(joinId),
// or drop { explicitJoins: true } to keep the inference.
```

The error names the gateway it would have added, which is the id you pass to `.connectTo()`.

A join you declare only counts if it **matches the split**: an exclusive split converging on a
parallel gateway is not the gateway inference would have added, so it is still inferred — and
with `explicitJoins` that refusal is the only thing that tells you.

`Bpmn.continueProcess()` never infers joins at all, whatever this option says. Inference reads
the whole topology, and on a document you were handed that means rewriting edges you never
touched.

`{ strict: true }` is the former name for this option and still works. It was renamed because
"strict" says nothing about what it is strict *about*, and because `applyBpmnOperations` takes
a `strict` that means something else entirely.

---
Source: https://bpmnkit.com/docs/packages/core
