---
title: Using BPMN Kit with AI
description: Give an AI agent the three things it needs to build a process — BPMN Kit's own docs, Camunda's docs, and your team's prose — all indexed offline, then generate the BPMN.
sidebar:
  order: 7
---

An agent asked to turn a folder of specs into a deployable process needs three
different kinds of knowledge, and only one of them is in its weights:

| It needs to know | Where that lives | How it asks |
| --- | --- | --- |
| How to drive this library | `@bpmnkit/docspack` | `bpmnkit-docs ask "…"` |
| How the engine behaves | `@bpmnkit/camunda-docspack` | `bpmnkit-docs ask "…" --pack @bpmnkit/camunda-docspack` |
| What the process actually does | your own Markdown | index it yourself, below |

All three are offline retrieval. Nothing here calls a model, starts a server or
touches the network, so a question costs milliseconds and no tokens. The model
is only spent on the last step — turning what it found into a diagram.

## The two packs BPMN Kit ships

```sh
npm i -D @bpmnkit/docspack @bpmnkit/camunda-docspack
```

**[`@bpmnkit/docspack`](/docs/packages/docspack)** carries the documentation you
are reading — the builder API, the CLI, the guides — pinned to the version this
project installed.

**[`@bpmnkit/camunda-docspack`](/docs/packages/camunda-docspack)** carries the
Camunda 8 documentation: BPMN and FEEL references, engine concepts, the
best-practice pages with their diagrams rendered as text, and one digest per
Orchestration Cluster API operation. It is Camunda's work, redistributed under
CC BY-SA 3.0, not documentation BPMN Kit wrote.

One `bpmnkit-docs` command reads both.

## Telling an agent they exist

An agent that does not know a pack is installed will answer from memory instead,
and its memory describes an older release. One paragraph in `AGENTS.md`,
`CLAUDE.md` or `.cursor/rules` is the whole setup — **name both packs**, because
an agent told only about the first will never think to ask the second:

```md
Documentation is installed locally. Ask it before answering from memory.

- BPMN Kit's own APIs, CLI and guides:
  `npx bpmnkit-docs ask "<question>"`
- Camunda 8 — BPMN semantics, FEEL, engine behaviour, the REST API:
  `npx bpmnkit-docs ask "<question>" --pack @bpmnkit/camunda-docspack`

A returned chunk beats recalled knowledge: it describes the version this project
installed. If the two disagree, the chunk is right — do not blend them.
Answers cap at 3 chunks / 3,000 tokens, so ask several narrow questions rather
than one broad one.
```

## Asking

```sh
npx bpmnkit-docs ask "what does compactify drop from a diagram"
```

```
## @bpmnkit/docspack@0.0.4/packages.core.installation-compactify-definitions

Projects a `BpmnDefinitions` object onto a `CompactDiagram` — a small JSON
object suitable for LLM prompts. **Lossy:** it keeps topology, names …

---
cost: 204 tokens, capped at 3,000
```

Every answer names the pack, the version and the chunk, and closes with what it
cost — so an agent can quote the chunk id back when a passage turns out to be
wrong.

Ask the engine's documentation with `--pack`:

```sh
npx bpmnkit-docs ask "what happens when no exclusive gateway condition is true" \
  --pack @bpmnkit/camunda-docspack
```

`--pack` is worth using even when you are not disambiguating. Building the index
reads every chunk off disk, so narrowing to one pack is the difference between
roughly 150ms and 650ms per question. A name that is not installed is an error
listing what is, never an empty answer — an empty answer would read as "the
documentation does not cover this", which is a different claim.

`search` ranks without printing the content, and `list` shows what was found:

```sh
npx bpmnkit-docs search "exclusive gateway condition"
npx bpmnkit-docs list
```

```
@bpmnkit/camunda-docspack@0.0.0  1054 chunks
@bpmnkit/docspack@0.0.4  205 chunks
```

## From the library instead of the CLI

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

  <!-- docspack: tags=carrier,refused,dispatcher -->
  ```

> The upstream [docspack](https://docspack.dev) project documents a second route
> for this — `docspack index --from ./notes` and `docspack recall "…"`, which
> keep an SQLite index of loose sources rather than building a pack. It is
> [documented](https://docspack.dev/docs/your-own-corpus/) but not yet in the
> published `docspack@1.0.0` CLI, which exits 2 on both commands. Until it ships,
> `bpmnkit-docs build` is the route that works.

## The whole loop: five Markdown files to a BPMN diagram

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

## Runnable examples

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

## Where to go next

- [AI Integration](/docs/guides/ai) — the compact format, prompting, the Claude
  and OpenAI calls, and the MCP server
- [Building Processes with AI](/docs/guides/ai-implement) — the `ProcessPlan`
  pipeline, which compiles rather than generating XML
- [AI Agents](/docs/guides/ai-agents) — putting an LLM *inside* a process as a
  Camunda AI Agent Sub-process
- [Claude Code Plugin](/docs/guides/claude-code-plugin) — the slash commands that
  drive all of it
