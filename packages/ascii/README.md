<div align="center">
  <img src="https://raw.githubusercontent.com/bpmnkit/monorepo/main/doc/logos/logo-2-gateway.svg" width="72" height="72" alt="BPMN Kit logo">
  <h1>@bpmnkit/ascii</h1>
  <p>Render BPMN diagrams as Unicode box-drawing ASCII art — perfect for terminals and docs</p>

  [![npm](https://img.shields.io/npm/v/@bpmnkit/ascii?style=flat-square&color=6244d7)](https://www.npmjs.com/package/@bpmnkit/ascii)
  [![license](https://img.shields.io/npm/l/@bpmnkit/ascii?style=flat-square)](https://github.com/bpmnkit/monorepo/blob/main/LICENSE)
  [![typescript](https://img.shields.io/badge/TypeScript-strict-6244d7?style=flat-square&logo=typescript&logoColor=white)](https://github.com/bpmnkit/monorepo)

  [Documentation](https://docs.bpmnkit.com) · [GitHub](https://github.com/bpmnkit/monorepo) · [Changelog](https://github.com/bpmnkit/monorepo/blob/main/packages/ascii/CHANGELOG.md)
</div>

---

## Overview

`@bpmnkit/ascii` converts BPMN 2.0 diagrams into Unicode box-drawing text art. It uses the same Sugiyama layout engine as the visual renderer, so the spatial flow of the diagram is preserved.

Useful for: CLI output, plain-text documentation, terminal UIs, test snapshots, and LLM prompts where visual BPMN isn't available.

## Features

- **Unicode box-drawing** — `┌─┐`, `│`, `└─┘`, `→` for clean terminal output
- **Automatic layout** — uses `@bpmnkit/core`'s layout engine
- **All element types** — tasks, events, gateways, sub-processes
- **Configurable output** — optional title, element type labels
- **Zero additional dependencies** — only requires `@bpmnkit/core` (already bundled)

## Installation

```sh
npm install @bpmnkit/ascii
```

## Quick Start

```typescript
import { renderBpmnAscii } from "@bpmnkit/ascii"
import { readFileSync } from "node:fs"

const xml = readFileSync("my-process.bpmn", "utf8")
const art = renderBpmnAscii(xml, { title: true, showTypes: true })
console.log(art)
```

### Example output

```
Order Flow
══════════════════════════════════════════════
  ╭──────────╮     ╭───────────────╮     ╭╮
  │  Order   │────▶│ Validate Order│────▶││
  │ Received │     │ (ServiceTask) │     │◇│
  ╰──────────╯     ╰───────────────╯     ╰╯
                                          │
                         ╭───────────────╯│╰───────────────╮
                         ▼                                  ▼
                   ╭───────────╮                    ╭──────────────╮
                   │  Fulfill  │                    │    Reject    │
                   │   Order   │                    │    Order     │
                   ╰───────────╯                    ╰──────────────╯
```

## API Reference

```typescript
function renderBpmnAscii(xml: string, options?: RenderOptions): string

interface RenderOptions {
  title?: boolean     // Show process name as header. Default: false
  showTypes?: boolean // Include element type in boxes. Default: false
}
```

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
| [`@bpmnkit/ui`](https://www.npmjs.com/package/@bpmnkit/ui) | Shared design tokens and UI components |
| [`@bpmnkit/profiles`](https://www.npmjs.com/package/@bpmnkit/profiles) | Shared auth, profile storage, and client factories for CLI & proxy |
| [`@bpmnkit/operate`](https://www.npmjs.com/package/@bpmnkit/operate) | Monitoring & operations frontend for Camunda clusters |
| [`@bpmnkit/connector-gen`](https://www.npmjs.com/package/@bpmnkit/connector-gen) | Generate connector templates from OpenAPI specs |
| [`@bpmnkit/cli`](https://www.npmjs.com/package/@bpmnkit/cli) | Camunda 8 command-line interface (casen) |
| [`@bpmnkit/proxy`](https://www.npmjs.com/package/@bpmnkit/proxy) | Local AI bridge and Camunda API proxy server |

## License

[MIT](https://github.com/bpmnkit/monorepo/blob/main/LICENSE) © BPMN Kit
