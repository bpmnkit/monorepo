<div align="center">
  <img src="https://raw.githubusercontent.com/bpmn-sdk/monorepo/main/doc/logos/logo-2-gateway.svg" width="72" height="72" alt="BPMN SDK logo">
  <h1>@bpmn-sdk/ascii</h1>
  <p>Render BPMN diagrams as Unicode box-drawing ASCII art — perfect for terminals and docs</p>

  [![npm](https://img.shields.io/npm/v/@bpmn-sdk/ascii?style=flat-square&color=6244d7)](https://www.npmjs.com/package/@bpmn-sdk/ascii)
  [![license](https://img.shields.io/npm/l/@bpmn-sdk/ascii?style=flat-square)](https://github.com/bpmn-sdk/monorepo/blob/main/LICENSE)
  [![typescript](https://img.shields.io/badge/TypeScript-strict-6244d7?style=flat-square&logo=typescript&logoColor=white)](https://github.com/bpmn-sdk/monorepo)

  [Website](https://bpmnsdk.u11g.com) · [Documentation](https://bpmnsdkdocs.u11g.com) · [GitHub](https://github.com/bpmn-sdk/monorepo) · [Changelog](https://github.com/bpmn-sdk/monorepo/blob/main/packages/ascii/CHANGELOG.md)
</div>

---

## Overview

`@bpmn-sdk/ascii` converts BPMN 2.0 diagrams into Unicode box-drawing text art. It uses the same Sugiyama layout engine as the visual renderer, so the spatial flow of the diagram is preserved.

Useful for: CLI output, plain-text documentation, terminal UIs, test snapshots, and LLM prompts where visual BPMN isn't available.

## Features

- **Unicode box-drawing** — `┌─┐`, `│`, `└─┘`, `→` for clean terminal output
- **Automatic layout** — uses `@bpmn-sdk/core`'s layout engine
- **All element types** — tasks, events, gateways, sub-processes
- **Configurable output** — optional title, element type labels
- **Zero additional dependencies** — only requires `@bpmn-sdk/core` (already bundled)

## Installation

```sh
npm install @bpmn-sdk/ascii
```

## Quick Start

```typescript
import { renderBpmnAscii } from "@bpmn-sdk/ascii"
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
| [`@bpmn-sdk/core`](https://www.npmjs.com/package/@bpmn-sdk/core) | BPMN/DMN/Form parser, builder, layout engine |
| [`@bpmn-sdk/canvas`](https://www.npmjs.com/package/@bpmn-sdk/canvas) | Zero-dependency SVG BPMN viewer |
| [`@bpmn-sdk/editor`](https://www.npmjs.com/package/@bpmn-sdk/editor) | Full-featured interactive BPMN editor |
| [`@bpmn-sdk/engine`](https://www.npmjs.com/package/@bpmn-sdk/engine) | Lightweight BPMN process execution engine |
| [`@bpmn-sdk/feel`](https://www.npmjs.com/package/@bpmn-sdk/feel) | FEEL expression language parser & evaluator |
| [`@bpmn-sdk/plugins`](https://www.npmjs.com/package/@bpmn-sdk/plugins) | 22 composable canvas plugins |
| [`@bpmn-sdk/api`](https://www.npmjs.com/package/@bpmn-sdk/api) | Camunda 8 REST API TypeScript client |

## License

[MIT](https://github.com/bpmn-sdk/monorepo/blob/main/LICENSE) © bpmn-sdk
