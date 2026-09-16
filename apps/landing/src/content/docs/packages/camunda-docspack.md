---
title: "@bpmnkit/camunda-docspack"
description: The Camunda 8 documentation as an offline, version-locked package an AI agent can install and search — BPMN, FEEL, engine concepts and the Orchestration Cluster API.
sidebar:
  order: 9
---

## Overview

`@bpmnkit/camunda-docspack` packages the **Camunda 8 documentation** as a
[docspack](https://docspack.dev/spec) pack you can search offline: BPMN and FEEL
references, engine concepts, the best-practice pages, and one digest per
Orchestration Cluster API operation.

It is the companion to [`@bpmnkit/docspack`](/docs/packages/docspack), and the
split is the point. Ask ours how to *drive the library*; ask this one what the
*engine* does — gateway semantics, FEEL syntax, job activation, permissions.
Those are different questions and the right answer to one is the wrong answer to
the other.

> **This is Camunda's documentation, not BPMN Kit's.** The content is the work of
> Camunda Services GmbH and copyright in it remains with them. This package adds
> only the tooling that stages, chunks and indexes it. It is redistributed under
> **CC BY-SA 3.0**, the licence Camunda publishes it under — which is why this
> package is CC BY-SA 3.0 rather than MIT like the rest of BPMN Kit. BPMN Kit is
> not affiliated with, endorsed by or sponsored by Camunda. For canonical and
> current documentation prefer [docs.camunda.io](https://docs.camunda.io).

It is built from the `docs/` tree of
[camunda/camunda-docs](https://github.com/camunda/camunda-docs) — the unreleased
**8.10** documentation — plus the Orchestration Cluster API specification, and
rebuilt weekly.

## Installation

```sh
pnpm add -D @bpmnkit/camunda-docspack
```

There is no second CLI to learn: `bpmnkit-docs`, from
[`@bpmnkit/docspack`](/docs/packages/docspack), reads every pack installed.

## Asking it

```sh
npx bpmnkit-docs ask "how should I name an exclusive gateway" \
  --pack @bpmnkit/camunda-docspack
npx bpmnkit-docs ask "POST /jobs/activation" --pack @bpmnkit/camunda-docspack
npx bpmnkit-docs ask "what permissions does creating a process instance need" \
  --pack @bpmnkit/camunda-docspack
```

`--pack` both disambiguates and pays for itself: the index is built by reading
every chunk off disk, so narrowing to one pack is roughly 150ms against 650ms
across both. Leave it off when you do not know which pack answers.

Confirm it is installed before relying on it:

```sh
npx bpmnkit-docs list
```

```
@bpmnkit/camunda-docspack@0.0.0  1054 chunks
@bpmnkit/docspack@0.0.4  206 chunks
```

A pack missing from that list is a pack no answer can come from. See
[Using BPMN Kit with AI](/docs/guides/using-bpmnkit-with-ai) for the paragraph to
put in `AGENTS.md` or `CLAUDE.md` so an agent knows to ask both.

## What makes this corpus different

- **Diagrams as text.** The best-practice pages argue through embedded BPMN
  diagrams, and Camunda's own Markdown export drops them. Each one is rendered as
  a flow description instead, so a page about naming gateways still contains the
  gateway, its question and its conditions.
- **227 API operations.** One digest per endpoint, read from the specification
  rather than from the generated reference pages, with required permissions
  decoded, the version it appeared in, and its consistency guarantee.
- **Every chunk cites its page.** Links are rewritten to absolute
  `docs.camunda.io` URLs and each chunk ends with the page it came from.
- **Nothing dropped silently.** An MDX component the build does not recognise
  fails the build by file and line rather than quietly thinning the corpus.

## Rebuilding it

A weekly workflow (`.github/workflows/camunda-docspack.yml`) rebuilds the pack
from upstream. By hand you need a camunda-docs checkout:

```sh
node packages/camunda-docspack/dist/cli.js --camunda-docs ../camunda-docs
```

## API Reference

The published artefact is the `.llms/` payload; these exports are the build that
produces it.

| Export | Purpose |
| --- | --- |
| `build(options)` | Stage a camunda-docs checkout and write the `.llms/` payload |
| `stage(options)` | Run the staging transforms only, to a directory |
| `bpmnToText(xml)` | Render a BPMN diagram as a compact flow description |
| `readOperations(entry)` | Read one digest per operation from an OpenAPI document |
| `stripMdx(source, options)` | Reduce Camunda's MDX to indexable Markdown |
| `absoluteLinks(markdown, slug)` | Rewrite relative links to `docs.camunda.io` URLs |
| `notice(commit)` | The CC BY-SA 3.0 attribution written on every build |

## A note on the pack's name

The docspack spec names one pack per npm scope, `@<vendor>/docspack`. A vendor
that also redistributes somebody else's documentation has nowhere to put it under
that rule, so this pack is `@bpmnkit/camunda-docspack` and `bpmnkit-docs` reads
the `-docspack` suffix as well as the bare name. It stays a pure name check
inside a scope BPMN Kit owns, so the pack carries the same trust as
`@bpmnkit/docspack`. A spec-strict reader — the upstream `docspack` CLI — will
only see `@bpmnkit/docspack`, so use `bpmnkit-docs` for this one.
