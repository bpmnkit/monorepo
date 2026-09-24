<div align="center">
  <a href="https://bpmnkit.com"><img src="https://bpmnkit.com/favicon.svg" width="72" height="72" alt="BPMN Kit logo"></a>
  <h1>@bpmnkit/markdown</h1>
  <p>Real BPMN diagrams in Markdown — render bpmn and bpmn-compact code blocks to inline, themeable, accessible SVG</p>

  [![npm](https://img.shields.io/npm/v/@bpmnkit/markdown?style=flat-square&color=6244d7)](https://www.npmjs.com/package/@bpmnkit/markdown)
  [![license](https://img.shields.io/npm/l/@bpmnkit/markdown?style=flat-square)](https://github.com/bpmnkit/monorepo/blob/main/LICENSE)
  [![typescript](https://img.shields.io/badge/TypeScript-strict-6244d7?style=flat-square&logo=typescript&logoColor=white)](https://github.com/bpmnkit/monorepo)
  [![ai-assisted](https://img.shields.io/badge/AI--assisted-claude-8b5cf6?style=flat-square)](https://github.com/bpmnkit/monorepo)
  [![experimental](https://img.shields.io/badge/status-experimental-f59e0b?style=flat-square)](https://bpmnkit.com/docs/getting-started/stability)

  [Website](https://bpmnkit.com) · [Documentation](https://bpmnkit.com/docs) · [GitHub](https://github.com/bpmnkit/monorepo) · [Changelog](https://github.com/bpmnkit/monorepo/blob/main/packages/markdown/CHANGELOG.md)
</div>

---

## Overview

Mermaid has no BPMN, and PlantUML's BPMN is a sketch. `@bpmnkit/markdown` renders fenced ```bpmn``` (BPMN 2.0 XML) and ```bpmn-compact``` (compact JSON) code blocks to real BPMN diagrams — inline SVG, at build time, with no client-side JavaScript. Astro, Docusaurus, VitePress, Next.js MDX and GitHub READMEs are all covered.

Every integration is a thin adapter over one function, `renderBpmnBlock()`, so a block renders the same everywhere.

## Features

- **Two input formats** — BPMN 2.0 XML (its own layout when it carries DI, auto-layout when it does not) and the compact JSON format from `compactify()`
- **remark plugin** — Astro, Docusaurus, Next.js MDX, unified; emits hast, so it works in MDX too
- **markdown-it plugin** — VitePress and other markdown-it sites
- **HTML rewriter** — for pipelines with no plugin hook
- **`bpmnkit-md` CLI** — pre-renders blocks in a README to committed SVG files, idempotently, with a `--check` mode for CI
- **Themeable** — follows the page's `--bpmnkit-*` tokens, else the reader's colour scheme; or pin `light` / `dark`
- **Accessible** — `role="img"`, a `<title>` from the process name and a `<desc>` listing its steps
- **Build-safe errors** — an unparsable block renders as a readable error box, or fails the build if you prefer
- **Deterministic** — the same block always yields the same bytes
- **No dependencies** beyond `@bpmnkit/core` — no unified, no markdown-it

## Installation

```sh
npm install --save-dev @bpmnkit/markdown
```

## Quick Start

Write a block:

````md
```bpmn-compact title="Order fulfilment"
{
  "id": "order",
  "elements": [
    { "id": "start", "type": "startEvent", "name": "Order received" },
    { "id": "ship", "type": "serviceTask", "name": "Ship order" },
    { "id": "end", "type": "endEvent", "name": "Shipped" }
  ],
  "flows": [
    { "id": "f1", "from": "start", "to": "ship" },
    { "id": "f2", "from": "ship", "to": "end" }
  ]
}
```
````

Then plug it in:

```typescript
// Astro — astro.config.mjs
import { remarkBpmn } from "@bpmnkit/markdown"
export default defineConfig({ markdown: { remarkPlugins: [remarkBpmn] } })

// VitePress — .vitepress/config.ts
import { markdownItBpmn } from "@bpmnkit/markdown"
export default defineConfig({ markdown: { config: (md) => md.use(markdownItBpmn) } })
```

For a GitHub README, pre-render to committed SVGs:

```sh
npx bpmnkit-md README.md          # rewrite blocks into image + folded source regions
npx bpmnkit-md --check README.md  # CI: exit 1 when out of date
```

## API Reference

```typescript
function renderBpmnBlock(code: string, lang: BpmnLang, options?: RenderOptions): RenderResult
function remarkBpmn(options?: RenderOptions): (tree, file?) => void
function markdownItBpmn(md: MarkdownIt, options?: RenderOptions): void
function renderBpmnInHtml(html: string, options?: RenderOptions): string
function prerenderMarkdown(markdown: string, options?: PrerenderOptions): PrerenderResult

type BpmnLang = "bpmn" | "bpmn-compact" | "bpmn-json"

interface RenderOptions {
  theme?: "auto" | "light" | "dark"   // default "auto"
  maxWidth?: number                   // CSS px
  title?: string                      // accessible name; default: the process name
  link?: (d: { xml: string; title: string }) => string  // "Open in BPMN Kit" link, off by default
  onError?: "render" | "throw"        // default "render"
}

type RenderResult =
  | { ok: true; svg: string; html: string; title: string }
  | { ok: false; error: string; html: string }
```

Full guide: https://bpmnkit.com/docs/guides/bpmn-in-markdown

---

## Related Packages

| Package | Description |
|---------|-------------|
| [`@bpmnkit/core`](https://www.npmjs.com/package/@bpmnkit/core) | BPMN/DMN/Form parser, builder, layout engine |
| [`@bpmnkit/canvas`](https://www.npmjs.com/package/@bpmnkit/canvas) | Zero-dependency SVG BPMN viewer |
| [`@bpmnkit/editor`](https://www.npmjs.com/package/@bpmnkit/editor) | Full-featured interactive BPMN editor |
| [`@bpmnkit/engine`](https://www.npmjs.com/package/@bpmnkit/engine) | Lightweight BPMN process simulator for tests and demos |
| [`@bpmnkit/feel`](https://www.npmjs.com/package/@bpmnkit/feel) | FEEL expression language parser & evaluator |
| [`@bpmnkit/plugins`](https://www.npmjs.com/package/@bpmnkit/plugins) | 34 composable canvas plugins |
| [`@bpmnkit/api`](https://www.npmjs.com/package/@bpmnkit/api) | Camunda 8 REST API TypeScript client |
| [`@bpmnkit/ascii`](https://www.npmjs.com/package/@bpmnkit/ascii) | Render BPMN diagrams as Unicode ASCII art |
| [`@bpmnkit/docspack`](https://www.npmjs.com/package/@bpmnkit/docspack) | BPMN Kit docs as an offline docspack package for AI agents |
| [`@bpmnkit/camunda-docspack`](https://www.npmjs.com/package/@bpmnkit/camunda-docspack) | Camunda 8 docs as an offline docspack package for AI agents |
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
