<div align="center">
  <a href="https://bpmnkit.com"><img src="https://bpmnkit.com/favicon.svg" width="72" height="72" alt="BPMN Kit logo"></a>
  <h1>@bpmnkit/camunda-docspack</h1>
  <p>Camunda 8 documentation as an offline, version-locked docspack package for AI agents</p>

  [![npm](https://img.shields.io/npm/v/@bpmnkit/camunda-docspack?style=flat-square&color=6244d7)](https://www.npmjs.com/package/@bpmnkit/camunda-docspack)
  [![license](https://img.shields.io/npm/l/@bpmnkit/camunda-docspack?style=flat-square)](https://github.com/bpmnkit/monorepo/blob/main/LICENSE)
  [![typescript](https://img.shields.io/badge/TypeScript-strict-6244d7?style=flat-square&logo=typescript&logoColor=white)](https://github.com/bpmnkit/monorepo)
  [![ai-assisted](https://img.shields.io/badge/AI--assisted-claude-8b5cf6?style=flat-square)](https://github.com/bpmnkit/monorepo)
  [![experimental](https://img.shields.io/badge/status-experimental-f59e0b?style=flat-square)](https://github.com/bpmnkit/monorepo)

  [Website](https://bpmnkit.com) · [Documentation](https://bpmnkit.com/docs) · [GitHub](https://github.com/bpmnkit/monorepo) · [Changelog](https://github.com/bpmnkit/monorepo/blob/main/packages/camunda-docspack/CHANGELOG.md)
</div>

---

## Overview

`@bpmnkit/camunda-docspack` packages the Camunda 8 documentation — BPMN, FEEL, engine concepts and the Orchestration Cluster API — as a [docspack](https://docspack.dev/spec) pack you can search offline, with no network call and no MCP server.

It is built from the `docs/` tree of [camunda/camunda-docs](https://github.com/camunda/camunda-docs), which is the unreleased **8.10** documentation, plus the Orchestration Cluster API specification.

## Features

- **Diagrams as text** — the best-practice pages argue through embedded BPMN diagrams. Camunda's own Markdown export drops them; this renders each one as a flow description, so a page about naming gateways still contains the gateway, its question and its conditions.
- **227 API operations** — one digest per endpoint, read from the specification rather than from the generated reference pages, with required permissions decoded, the version it appeared in, and its consistency guarantee.
- **Every chunk cites its page** — links are rewritten to absolute `docs.camunda.io` URLs, and each chunk ends with the page it came from.
- **Nothing dropped silently** — an MDX component the build does not recognise fails the build by file and line instead of quietly thinning the corpus.
- **Offline** — one SQLite-free local index; no server, nothing resident.

## Installation

```sh
npm i -D @bpmnkit/camunda-docspack
pnpm add -D @bpmnkit/camunda-docspack
```

## Quick Start

Search it with the CLI that ships in `@bpmnkit/docspack`:

```sh
npx bpmnkit-docs ask "how should I name an exclusive gateway"
npx bpmnkit-docs ask "POST /jobs/activation"
npx bpmnkit-docs ask "what permissions does creating a process instance need"
npx bpmnkit-docs ask "FEEL string concatenation" --pack @bpmnkit/camunda-docspack
```

Answers cap at 3 chunks / 3,000 tokens, so prefer several narrow questions to one broad one.

## API Reference

The published artefact is the `.llms/` payload. These exports are the build that produces it:

| Export | Purpose |
| --- | --- |
| `build(options)` | Stage a camunda-docs checkout and write the `.llms/` payload |
| `stage(options)` | Run the staging transforms only, to a directory |
| `bpmnToText(xml)` | Render a BPMN diagram as a compact flow description |
| `readOperations(entry)` | Read one digest per operation from an OpenAPI document |
| `stripMdx(source, options)` | Reduce Camunda's MDX to indexable Markdown |
| `absoluteLinks(markdown, slug)` | Rewrite relative links to `docs.camunda.io` URLs |
| `notice(commit)` | The CC BY-SA 3.0 attribution written on every build |

Rebuild the pack against a checkout:

```sh
node packages/camunda-docspack/dist/cli.js --camunda-docs ../camunda-docs
```

## Licence

The documentation content is adapted from camunda/camunda-docs, © Camunda Services GmbH, licensed **CC BY-SA 3.0**. ShareAlike requires this adaptation to carry the same terms, so this package is CC BY-SA 3.0 rather than MIT like the rest of BPMN Kit. See `NOTICE` for the attribution and the list of changes.

BPMN Kit is not affiliated with or endorsed by Camunda Services GmbH.
---

## Related Packages

| Package | Description |
|---------|-------------|
| [`@bpmnkit/core`](https://www.npmjs.com/package/@bpmnkit/core) | BPMN/DMN/Form parser, builder, layout engine |
| [`@bpmnkit/canvas`](https://www.npmjs.com/package/@bpmnkit/canvas) | Zero-dependency SVG BPMN viewer |
| [`@bpmnkit/editor`](https://www.npmjs.com/package/@bpmnkit/editor) | Full-featured interactive BPMN editor |
| [`@bpmnkit/engine`](https://www.npmjs.com/package/@bpmnkit/engine) | Lightweight BPMN process execution engine |
| [`@bpmnkit/feel`](https://www.npmjs.com/package/@bpmnkit/feel) | FEEL expression language parser & evaluator |
| [`@bpmnkit/plugins`](https://www.npmjs.com/package/@bpmnkit/plugins) | 22 composable canvas plugins |
| [`@bpmnkit/api`](https://www.npmjs.com/package/@bpmnkit/api) | Camunda 8 REST API TypeScript client |
| [`@bpmnkit/ascii`](https://www.npmjs.com/package/@bpmnkit/ascii) | Render BPMN diagrams as Unicode ASCII art |
| [`@bpmnkit/docspack`](https://www.npmjs.com/package/@bpmnkit/docspack) | BPMN Kit docs as an offline docspack package for AI agents |
| [`@bpmnkit/ui`](https://www.npmjs.com/package/@bpmnkit/ui) | Shared design tokens and UI components |
| [`@bpmnkit/profiles`](https://www.npmjs.com/package/@bpmnkit/profiles) | Shared auth, profile storage, and client factories for CLI & proxy |
| [`@bpmnkit/operate`](https://www.npmjs.com/package/@bpmnkit/operate) | Monitoring & operations frontend for Camunda clusters |
| [`@bpmnkit/connector-gen`](https://www.npmjs.com/package/@bpmnkit/connector-gen) | Generate connector templates from OpenAPI specs |
| [`@bpmnkit/connectors`](https://www.npmjs.com/package/@bpmnkit/connectors) | Camunda 8 OOTB connector catalog and deterministic template application |
| [`@bpmnkit/cli`](https://www.npmjs.com/package/@bpmnkit/cli) | Camunda 8 command-line interface (casen) |
| [`@bpmnkit/proxy`](https://www.npmjs.com/package/@bpmnkit/proxy) | Local AI bridge and Camunda API proxy server |
| [`@bpmnkit/patterns`](https://www.npmjs.com/package/@bpmnkit/patterns) | Domain process patterns for BPMNKit AIKit |
| [`@bpmnkit/reebe-wasm`](https://www.npmjs.com/package/@bpmnkit/reebe-wasm) | WebAssembly BPMN engine for browser simulation |
| [`@bpmnkit/worker-client`](https://www.npmjs.com/package/@bpmnkit/worker-client) | Thin Zeebe REST client for standalone workers |
| [`@bpmnkit/user-tasks`](https://www.npmjs.com/package/@bpmnkit/user-tasks) | Embeddable user task widget for Camunda 8 |
| [`@bpmnkit/cli-sdk`](https://www.npmjs.com/package/@bpmnkit/cli-sdk) | Plugin authoring SDK for the casen CLI |
| [`@bpmnkit/create-casen-plugin`](https://www.npmjs.com/package/@bpmnkit/create-casen-plugin) | Scaffold a new casen CLI plugin in seconds |
| [`@bpmnkit/casen-report`](https://www.npmjs.com/package/@bpmnkit/casen-report) | HTML reports from Camunda 8 incident and SLA data |
| [`@bpmnkit/casen-worker-http`](https://www.npmjs.com/package/@bpmnkit/casen-worker-http) | Example HTTP worker plugin — completes jobs with live JSONPlaceholder API data |
| [`@bpmnkit/casen-worker-ai`](https://www.npmjs.com/package/@bpmnkit/casen-worker-ai) | AI task worker — classify, summarize, extract, and decide using Claude |

## License

[MIT](https://github.com/bpmnkit/monorepo/blob/main/LICENSE) © BPMN Kit — made by [u11g](https://u11g.com)

<div align="center">
  <a href="https://bpmnkit.com"><img src="https://bpmnkit.com/favicon.svg" width="32" height="32" alt="BPMN Kit"></a>
</div>
