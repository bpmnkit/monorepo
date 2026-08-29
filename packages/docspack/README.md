<div align="center">
  <a href="https://bpmnkit.com"><img src="https://bpmnkit.com/favicon.svg" width="72" height="72" alt="BPMN Kit logo"></a>
  <h1>@bpmnkit/docspack</h1>
  <p>BPMN Kit documentation as an offline, version-locked docspack package with a built-in search CLI for AI agents</p>

  [![npm](https://img.shields.io/npm/v/@bpmnkit/docspack?style=flat-square&color=6244d7)](https://www.npmjs.com/package/@bpmnkit/docspack)
  [![license](https://img.shields.io/npm/l/@bpmnkit/docspack?style=flat-square)](https://github.com/bpmnkit/monorepo/blob/main/LICENSE)
  [![typescript](https://img.shields.io/badge/TypeScript-strict-6244d7?style=flat-square&logo=typescript&logoColor=white)](https://github.com/bpmnkit/monorepo)
  [![ai-assisted](https://img.shields.io/badge/AI--assisted-claude-8b5cf6?style=flat-square)](https://github.com/bpmnkit/monorepo)
  [![experimental](https://img.shields.io/badge/status-experimental-f59e0b?style=flat-square)](https://github.com/bpmnkit/monorepo)

  [Website](https://bpmnkit.com) · [Documentation](https://bpmnkit.com/docs) · [GitHub](https://github.com/bpmnkit/monorepo) · [Changelog](https://github.com/bpmnkit/monorepo/blob/main/packages/docspack/CHANGELOG.md)
</div>

---

## Overview

`@bpmnkit/docspack` ships the BPMN Kit documentation the way an AI agent can actually use it: as an npm package whose version tracks the docs, indexed locally and searched offline.

An agent installs it, asks a question, and gets back the two or three passages that answer it — not a whole documentation site, and not whatever the model remembers about an older release.

It follows the [docspack package format](https://docspack.dev/spec), so the upstream `docspack` CLI discovers and indexes it like any other vendor pack. The bundled `bpmnkit-docs` command does the same job with no extra tooling.

```
Markdown docs → chunks + manifest → BM25 index → three passages
```

## Features

- **Offline** — `ask`, `search` and `list` read the filesystem only. No server, no network call, nothing resident between questions
- **Version-locked** — the installed `package.json` version wins over the manifest, so an agent reads the docs for the release it has
- **Bounded answers** — three chunks and 3,000 tokens by default, budgeted from the manifest before any content is read
- **Real retrieval** — BM25 over chunk text with Porter stemming, so `authenticate` finds a passage that only says `authentication`; tags and API identifiers weigh 3× prose
- **docspack-compatible** — `.llms/manifest.json` validates against `https://docspack.dev/schema/v1.json`
- **Safe by construction** — a manifest is untrusted input: chunk paths that escape `.llms/` are refused, and community packages are labelled
- **Zero runtime dependencies**

## Installation

```sh
npm install -D @bpmnkit/docspack
```

## Quick Start

Give an agent one line in `AGENTS.md` or `CLAUDE.md`:

```
Run \`npx bpmnkit-docs ask "<question>"\` for BPMN Kit documentation.
It answers from the version this project installed.
```

Then:

```sh
npx bpmnkit-docs ask "how do I deploy a process to Camunda 8"
npx bpmnkit-docs search "exclusive gateway"
npx bpmnkit-docs list
```

```
## @bpmnkit/docspack@0.0.1/getting-started.quick-start.step-3-deploy-and-run

# Quick Start — Step 3: Deploy and run
...

---
cost: 1,204 tokens, capped at 3,000
```

## API Reference

```typescript
// Discover and index every docs package installed under a directory
function discoverPacks(cwd?: string): Pack[]
function indexPacks(packs: readonly Pack[]): DocsIndex

// Rank chunks, or take the top ones that fit a token budget
function search(index: DocsIndex, query: string, options?: SearchOptions): SearchHit[]
function answer(
  index: DocsIndex,
  query: string,
  options?: AnswerOptions,
): { hits: SearchHit[]; tokens: number; maxTokens: number }

interface SearchOptions {
  limit?: number      // chunks to return. Default: 3
  packs?: readonly string[] // restrict to these package names
}

interface AnswerOptions extends SearchOptions {
  maxTokens?: number  // ceiling for an answer. Default: 3000
}

// Generate a .llms/ payload from a directory of Markdown
function buildPack(options: BuildOptions): BuildResult

// Read one package, validating it the way a consumer must
function loadPack(dir: string): Pack
```

### CLI

| Command | Purpose |
| --- | --- |
| `bpmnkit-docs ask <question>` | Answer from the installed docs packages — the command to give an agent |
| `bpmnkit-docs search <query>` | Rank matching chunks, for reading in a terminal |
| `bpmnkit-docs list` | Show the docs packages found and their index state |
| `bpmnkit-docs build` | Regenerate this package's `.llms/` payload from the docs source |

Options: `--limit <n>`, `--max-tokens <n>`, `--pack <name>`, `--cwd <dir>`.

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
