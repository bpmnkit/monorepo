---
title: "BPMN Kit 1.0: twelve packages take the stability promise"
description: "What 1.0.0 means for BPMN Kit — which packages it covers, what counts as a breaking change, what is measured and what is still missing."
pubDate: 2026-09-23
author: "BPMN Kit"
tags: ["release", "stability", "bpmn", "camunda"]
---

On 19 September, twelve BPMN Kit packages reached **1.0.0**. This post explains what that
promises, what it does not, and what comes next.

## 1.0 is a promise about breakage

A 1.0.0 is not a quality badge. It is a contract: from now on you can write `^1` in your
`package.json` and no upgrade inside that range should break your code. The
[Stability and Versioning](/docs/getting-started/stability) page spells out the details
semver leaves open for a toolkit that also emits XML, writes files and speaks HTTP:

- **What is public API.** What a package's `exports` entry points export, minus anything
  marked `@internal`. Deep imports into `dist/` are not covered.
- **When generated BPMN counts as a breaking change.** A builder that produces different XML
  for the same code can break a deployment, so the page says when that is a major.
- **Which runtimes are supported**, and how the Node.js floor moves.
- **How long each major is supported**, and how deprecations run.

The promise is enforced by checks, not only by prose:

- The exported surface of every stable package — 1,491 exports today — is snapshotted in
  `api-surface.json`, and CI fails if it changes without the snapshot being updated.
- The list of stable packages lives in one place, `scripts/published-packages.mjs`. Nothing
  on it may lack tests or a documentation page, and nothing at 1.0 or above may be missing
  from it, so a major version cannot arrive by accident.
- Every tarball is packed, installed into a throwaway project, imported, and type-checked
  against a strict `NodeNext` consumer before it is published.

## The twelve

| Package | What it is |
|---|---|
| [`@bpmnkit/core`](/docs/packages/core) | Parse, build, lay out, validate and write BPMN, DMN and Camunda Forms |
| [`@bpmnkit/canvas`](/docs/packages/canvas) | Zero-dependency SVG viewer |
| [`@bpmnkit/editor`](/docs/packages/editor) | Interactive BPMN editor |
| [`@bpmnkit/plugins`](/docs/packages/plugins) | 34 canvas and editor plugins |
| [`@bpmnkit/feel`](/docs/packages/feel) | FEEL parser and evaluator |
| [`@bpmnkit/engine`](/docs/packages/engine) | In-process simulator for tests and demos |
| [`@bpmnkit/api`](/docs/packages/api) | Typed Camunda 8 REST client |
| [`@bpmnkit/connectors`](/docs/packages/connectors) | Camunda connector templates, applied deterministically |
| [`@bpmnkit/connector-gen`](/docs/packages/connector-gen) | OpenAPI to connector templates |
| [`@bpmnkit/ascii`](/docs/packages/ascii) | BPMN as Unicode art |
| [`@bpmnkit/docspack`](/docs/packages/docspack) | These docs, offline, for AI agents |
| [`@bpmnkit/cli`](/docs/cli/casen) | `casen`, the command-line interface |

The other fifteen published packages stay on 0.x on purpose. Some are not ready to freeze;
the rest are examples, scaffolders or generated builds with no API of their own. Under
semver, 0.x promises nothing, so pin an exact version of those if one matters to you.

## What is measured

We would rather show a number than an adjective, so the new
[Conformance](/docs/getting-started/conformance) page collects what is measured:

- **FEEL passes 1,939 of the 2,053 FEEL cases in the DMN TCK (94.4%).** The cases that fail
  are listed with their reasons, and a weekly workflow re-runs the suite against the latest
  TCK.
- **BPMN model coverage** against the vendored BPMN, DI and Zeebe descriptors: 109 types
  modelled, 34 preserved verbatim, 6 dropped (all data-association internals). A build gate
  fails if a new type would be dropped silently.
- **Element support** for each component — model, renderer, editor and simulator — in one
  table, including what the simulator does *not* execute.

## What is still missing

1.0 covers the APIs above. It does not mean the toolkit is finished. The gaps we know about:

- We have not yet run the OMG **BPMN MIWG** interchange suite. The round-trip corpus is
  hand-written fixtures plus the descriptor gate.
- There is **no Camunda 7** support, and no choreography or conversation diagrams.
- The **simulator** does not execute call activities, event sub-processes, event-based
  gateways, multi-instance or signal, escalation and compensation events. The
  WebAssembly build of the Reebe engine covers more of this, and is still experimental.
- **Linting** uses BPMN Kit's own rules. It does not read `bpmnlint` configurations yet.
- **Auto-layout** is fast, but on the bpmn-auto-layout fixture set it still routes more edges
  through shapes than bpmn-auto-layout 2.0 does.

## What comes next

- **Installers and extensions.** The VS Code extension is now packaged on every release and
  attached to GitHub Releases, with Visual Studio Marketplace and Open VSX listings to
  follow. The desktop app gets Windows, macOS and Linux installers the same way.
- **Your coding agent.** Each CLI release submits the MCP server (`casen proxy mcp`) to the
  official MCP Registry, so Claude Code, Cursor and VS Code can find it.
- **Interoperability.** MIWG results, `bpmnlint` compatibility and a larger round-trip corpus
  built from real models.

Everything is MIT-licensed, developed in the open on
[GitHub](https://github.com/bpmnkit/monorepo), and every package's `CHANGELOG.md` says what
changed. If something on this page is wrong, or you are using BPMN Kit and want to tell us
how, [open an issue](https://github.com/bpmnkit/monorepo/issues) or write to
[hello@bpmnkit.com](mailto:hello@bpmnkit.com).
