<div align="center">
  <a href="https://bpmnkit.com"><img src="https://bpmnkit.com/favicon.svg" width="72" height="72" alt="BPMN Kit logo"></a>
  <h1>@bpmnkit/astro-shared</h1>
  <p>Shared CSS design tokens, aurora background, site metadata, and SEO helpers for BPMN Kit Astro apps</p>

  [![npm](https://img.shields.io/npm/v/@bpmnkit/astro-shared?style=flat-square&color=6244d7)](https://www.npmjs.com/package/@bpmnkit/astro-shared)
  [![license](https://img.shields.io/npm/l/@bpmnkit/astro-shared?style=flat-square)](https://github.com/bpmnkit/monorepo/blob/main/LICENSE)
  [![typescript](https://img.shields.io/badge/TypeScript-strict-6244d7?style=flat-square&logo=typescript&logoColor=white)](https://github.com/bpmnkit/monorepo)
  [![ai-assisted](https://img.shields.io/badge/AI--assisted-claude-8b5cf6?style=flat-square)](https://github.com/bpmnkit/monorepo)
  [![experimental](https://img.shields.io/badge/status-experimental-f59e0b?style=flat-square)](https://github.com/bpmnkit/monorepo)

  [Website](https://bpmnkit.com) · [Documentation](https://bpmnkit.com/docs) · [GitHub](https://github.com/bpmnkit/monorepo) · [Changelog](https://github.com/bpmnkit/monorepo/blob/main/packages/astro-shared/CHANGELOG.md)
</div>

---

## Overview

`@bpmnkit/astro-shared` provides shared CSS imports, site metadata, and SEO building blocks used across BPMN Kit's Astro-based apps (landing page, docs, learn, blog). It re-exports the design tokens from `@bpmnkit/ui`, adds a global aurora background animation, and ships a `<Seo>` head component plus schema.org JSON-LD helpers so every site emits consistent titles, canonicals, Open Graph tags, and structured data.

This package is primarily intended for internal use by BPMN Kit's own Astro applications.

## Installation

```sh
npm install @bpmnkit/astro-shared
```

## Usage

### Import design tokens in Astro layouts

```astro
---
import "@bpmnkit/astro-shared/tokens.css"
import "@bpmnkit/astro-shared/background.css"
---
```

### Access site metadata

```typescript
import { SITE } from "@bpmnkit/astro-shared"

console.log(SITE.name)    // "BPMN Kit"
console.log(SITE.docsUrl) // "https://bpmnkit.com/docs"
```

### Add SEO tags and structured data to a page

```astro
---
import Seo from "@bpmnkit/astro-shared/Seo.astro"
import { articleJsonLd } from "@bpmnkit/astro-shared/seo.js"
---
<html>
  <head>
    <Seo
      title="Generate BPMN diagrams with code"
      description="A TypeScript SDK for BPMN 2.0 diagrams."
      jsonLd={articleJsonLd({
        title: "...",
        description: "...",
        url: "https://bpmnkit.com/blog/example",
        datePublished: "2026-01-01",
        authorName: "BPMN Kit",
      })}
    />
  </head>
</html>
```

## Exports

| Export | Description |
|--------|-------------|
| `/tokens.css` | All `--bpmnkit-*` CSS custom properties (re-exports `@bpmnkit/ui/tokens.css`) |
| `/background.css` | Global aurora background animation styles |
| `/Seo.astro` | Shared `<Seo>` component — title, meta description, canonical URL, Open Graph, Twitter card, and JSON-LD |
| `/seo.js` | JSON-LD builders: `organizationJsonLd`, `softwareApplicationJsonLd`, `articleJsonLd`, `breadcrumbJsonLd`, `faqJsonLd` |
| `.` | `SITE` metadata object (name, url, github, docsUrl, learnUrl, blogUrl, npm) |

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
