# @bpmnkit/docspack — Using the index directly

The package is also a library, so a bot, an editor extension or an MCP server can search
without shelling out:

```typescript
import { answer, discoverPacks, indexPacks } from "@bpmnkit/docspack";

const index = indexPacks(discoverPacks());
const { hits, tokens } = answer(index, "verify a worker's job type", {
  limit: 3,
  maxTokens: 3000,
});

for (const hit of hits) {
  console.log(hit.chunkId, hit.content);
}
console.log(`${tokens} tokens`);
```


## How the pack is built

`bpmnkit-docs build` reads the Markdown under `apps/landing/src/content/docs`, splits each
document at its `##` headings, and writes one file per chunk:

```
packages/docspack/
├── package.json
├── llms.txt              table of contents
└── .llms/
    ├── manifest.json     chunk ids, token counts, tags, entities
    └── chunks/
        ├── guides.gateways.exclusive-gateway-xor.md
        └── ...
```

A section too large for the budget is subdivided at `###` and then at paragraph
boundaries, never inside a fenced code block. A section too short to answer anything is
merged into the one before it, so a reference table does not become one chunk per row.
Tags come from front matter, the page's slug and the heading's own words; entities are
the qualified identifiers named in inline code.

You can steer either from the document itself:

```md
## Two-column layout

```

---
Source: https://bpmnkit.com/docs/packages/docspack
