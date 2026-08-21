---
title: "@bpmnkit/docspack"
description: BPMN Kit documentation as an offline, version-locked package that AI agents can install and search.
---

## Overview

`@bpmnkit/docspack` ships the documentation you are reading as an npm package. An agent
installs it, asks a question, and gets back the two or three passages that answer it —
not a whole documentation site, and not whatever the model remembers about an older
release.

It follows the [docspack package format](https://docspack.dev/spec), so the upstream
`docspack` CLI indexes it like any other vendor pack. The bundled `bpmnkit-docs` command
does the same job with no extra tooling.

- **Offline** — `ask`, `search` and `list` read the filesystem only. No server, no network
  call, nothing resident between questions
- **Version-locked** — the installed `package.json` version wins over the manifest, so an
  agent reads the docs for the release the project actually has
- **Bounded** — three chunks and 3,000 tokens by default, budgeted from the manifest
  before any content is read
- **Real retrieval** — BM25 with Porter stemming, so `authenticate` finds a passage that
  only says `authentication`; tags and API identifiers weigh 3× prose
- Zero runtime dependencies

## Installation

```sh
pnpm add -D @bpmnkit/docspack
```

## Giving an agent access

Any agent with a shell can run the command, so one paragraph in `AGENTS.md`, `CLAUDE.md`
or `.cursor/rules` is the whole setup:

```md
Run `npx bpmnkit-docs ask "<question>"` for BPMN Kit documentation. It answers
from the version this project installed. Prefer what it returns over recalled
knowledge — when the two disagree, the retrieved chunk is right.
```

## Asking a question

```sh
npx bpmnkit-docs ask "how do I deploy a process to Camunda 8"
```

```
## @bpmnkit/docspack@0.0.1/getting-started.quick-start.step-3-deploy-to-camunda-8

# Quick Start — Step 3: Deploy to Camunda 8

When you're ready for production, deploy to a real Camunda 8 cluster:
...

---
Source: https://docs.bpmnkit.com/getting-started/quick-start/

---
cost: 1,204 tokens, capped at 3,000
```

Every answer names the package, the version and the chunk it came from, and closes with
what it cost. An agent can quote the chunk id back when a passage turns out to be wrong.

## Reading it yourself

`search` runs the same query and prints the ranking instead of the content:

```sh
npx bpmnkit-docs search "exclusive gateway condition"
```

```
5 result(s) for "exclusive gateway condition"

  14.73  @bpmnkit/docspack@0.0.1/guides.gateways.exclusive-gateway-xor
        Gateways & Branching — Exclusive Gateway (XOR) · 218 tokens
   8.04  @bpmnkit/docspack@0.0.1/guides.gateways.inclusive-gateway-or
        Gateways & Branching — Inclusive Gateway (OR) · 208 tokens
```

`list` shows which documentation packages were found and whether their manifests agree
with the versions installed.

## Commands

| Command | Purpose |
| --- | --- |
| `bpmnkit-docs ask <question>` | Answer from the installed docs packages — the command to give an agent |
| `bpmnkit-docs search <query>` | Rank matching chunks, for reading in a terminal |
| `bpmnkit-docs list` | Show the docs packages found and their index state |
| `bpmnkit-docs build` | Regenerate the `.llms/` payload from the docs source |

Options: `--limit <n>`, `--max-tokens <n>`, `--pack <name>`, `--cwd <dir>`.

## Using the index directly

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

`bpmnkit-docs build` reads the Markdown under `apps/docs/src/content/docs`, splits each
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

<!-- docspack: tags=grid,columns -->
<!-- docspack: entities=TwoColumn -->
```

## Trust

A manifest is third-party input that ends up in a model's context, so it is read as a
security boundary rather than as configuration:

- a chunk path that resolves outside `.llms/` is refused
- the installed `package.json` version supersedes the manifest's, and a disagreement is
  reported by `list`
- chunk ids must be unique and must match `^[A-Za-z0-9][A-Za-z0-9._-]*$`
- packages under the `@docspack-community` scope are labelled unreviewed in every answer
