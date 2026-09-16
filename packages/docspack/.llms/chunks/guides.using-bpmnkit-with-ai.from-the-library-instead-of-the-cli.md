# Using BPMN Kit with AI — From the library instead of the CLI

A long-lived agent, an editor extension or an MCP server should index once and
ask many times, rather than paying for the index on every question:

```typescript
import { answer, discoverPacks, indexPacks } from "@bpmnkit/docspack";

const index = indexPacks(discoverPacks());

const { hits, tokens } = answer(index, "verify a worker's job type", {
  packs: ["@bpmnkit/docspack"],
  limit: 3,
  maxTokens: 3000,
});

for (const hit of hits) console.log(hit.chunkId, hit.content);
console.log(`${tokens} tokens`);
```


## Indexing your own corpus

The packs above answer for BPMN Kit and for Camunda. Nothing answers for *your*
process — the five Markdown files somebody wrote describing how orders are
fulfilled. Handed the folder, an agent reads the wrong file or spends its whole
context on all of them; a corpus larger than the context window cannot be read
into it at all.

Index it, and it becomes something the agent asks questions of. The same builder
behind `bpmnkit-docs build` takes any folder of Markdown:

```sh
mkdir -p flow-corpus
cat > flow-corpus/package.json <<'JSON'
{
  "name": "order-fulfilment-corpus",
  "version": "1.0.0",
  "private": true,
  "docspack": { "source": "../flow-docs", "minTokens": 60, "maxTokens": 800 }
}
JSON

npx bpmnkit-docs build --cwd flow-corpus
npx bpmnkit-docs ask "when does an order need manager approval" --cwd flow-corpus
```

```
Built 5 chunks from 5 documents (421 tokens).

## order-fulfilment-corpus@1.0.0/02-approval.when-approval-is-needed

# Approval — When approval is needed

An order over 10000 EUR needs a regional manager to approve it before anything
is picked. At or under that figure the order goes straight to fulfilment.
```

Indexing runs no model, so building the corpus costs no tokens — five documents
take about 9ms.

A few things decide whether the result is any good:

- **Split at headings that answer something.** A chunk is a `##` section.
  `minTokens` merges a section too short to answer anything into the one before
  it, so a two-line heading does not become a chunk of its own.
- **`--cwd` points at the pack, not at the sources.** A directory holding a
  `package.json` and a `.llms/` payload *is* a pack, so `bpmnkit-docs` reads it
  without it ever being published.
- **Your corpus and the installed packs are searched together.** Discovery walks
  `node_modules` up from `--cwd`, so a corpus inside your project sees
  `@bpmnkit/docspack` too, and `--pack` narrows to whichever you want.
- **Keep it out of git, and re-index after editing.** The chunks are a copy of
  your files. Edit a source and the index is stale until you build again —
  `bpmnkit-docs build` is cheap enough to run on every change.
- **Tags weigh 3× prose.** Front matter, the slug and the heading's own words
  become tags automatically; steer them from the document itself when the words
  a reader would search for are not the words on the page:

  ```md
  ## Escalation

  ```

---
Source: https://bpmnkit.com/docs/guides/using-bpmnkit-with-ai
