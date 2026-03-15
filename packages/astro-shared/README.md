<div align="center">
  <img src="https://raw.githubusercontent.com/bpmnkit/monorepo/main/doc/logos/2026.svg" width="72" height="72" alt="BPMN Kit logo">
  <h1>@bpmnkit/astro-shared</h1>
  <p>Shared CSS design tokens, aurora background, and site metadata for BPMN Kit Astro apps</p>

  [![npm](https://img.shields.io/npm/v/@bpmnkit/astro-shared?style=flat-square&color=6244d7)](https://www.npmjs.com/package/@bpmnkit/astro-shared)
  [![license](https://img.shields.io/npm/l/@bpmnkit/astro-shared?style=flat-square)](https://github.com/bpmnkit/monorepo/blob/main/LICENSE)
  [![typescript](https://img.shields.io/badge/TypeScript-strict-6244d7?style=flat-square&logo=typescript&logoColor=white)](https://github.com/bpmnkit/monorepo)

  [Website](https://bpmnkit.com) · [Documentation](https://docs.bpmnkit.com) · [GitHub](https://github.com/bpmnkit/monorepo) · [Changelog](https://github.com/bpmnkit/monorepo/blob/main/packages/astro-shared/CHANGELOG.md)
</div>

---

## Overview

`@bpmnkit/astro-shared` provides shared CSS imports and site metadata used across BPMN Kit's Astro-based apps (landing page, docs, learn). It re-exports the design tokens from `@bpmnkit/ui` and adds a global aurora background animation.

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
console.log(SITE.docsUrl) // "https://docs.bpmnkit.com"
```

## Exports

| Export | Description |
|--------|-------------|
| `/tokens.css` | All `--bpmnkit-*` CSS custom properties (re-exports `@bpmnkit/ui/tokens.css`) |
| `/background.css` | Global aurora background animation styles |
| `.` | `SITE` metadata object (name, url, github, docsUrl, learnUrl, npm) |

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
| [`@bpmnkit/cli`](https://www.npmjs.com/package/@bpmnkit/cli) | Camunda 8 command-line interface (casen) |
| [`@bpmnkit/proxy`](https://www.npmjs.com/package/@bpmnkit/proxy) | Local AI bridge and Camunda API proxy server |

## License

[MIT](https://github.com/bpmnkit/monorepo/blob/main/LICENSE) © BPMN Kit — made by [u11g](https://u11g.com)
