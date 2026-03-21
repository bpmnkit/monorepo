<div align="center">
  <a href="https://bpmnkit.com"><img src="https://bpmnkit.com/favicon.svg" width="72" height="72" alt="BPMN Kit logo"></a>
  <h1>@bpmnkit/connector-gen</h1>
  <p>Generate Camunda REST connector element templates from OpenAPI/Swagger specs</p>

  [![npm](https://img.shields.io/npm/v/@bpmnkit/connector-gen?style=flat-square&color=6244d7)](https://www.npmjs.com/package/@bpmnkit/connector-gen)
  [![license](https://img.shields.io/npm/l/@bpmnkit/connector-gen?style=flat-square)](https://github.com/bpmnkit/monorepo/blob/main/LICENSE)
  [![typescript](https://img.shields.io/badge/TypeScript-strict-6244d7?style=flat-square&logo=typescript&logoColor=white)](https://github.com/bpmnkit/monorepo)

  [Website](https://bpmnkit.com) · [Documentation](https://docs.bpmnkit.com) · [GitHub](https://github.com/bpmnkit/monorepo) · [Changelog](https://github.com/bpmnkit/monorepo/blob/main/packages/connector-gen/CHANGELOG.md)
</div>

---

## Overview

`@bpmnkit/connector-gen` parses OpenAPI 3.x and Swagger 2.x specifications and generates Camunda REST connector element templates. Drop in your API spec and get a ready-to-import `.json` template that wires up request/response mappings automatically.

## Features

- **OpenAPI 3.x and Swagger 2.x** support
- **Generates Camunda element templates** — REST connector format with input/output mappings
- **Endpoint selection** — generate all endpoints or filter by path/method
- **FEEL expressions** — pre-fills input bindings with `=variable` expressions
- **Zero dependencies** beyond `yaml` for YAML parsing

## Installation

```sh
npm install @bpmnkit/connector-gen
```

## Quick Start

```typescript
import { generateConnectorTemplates } from "@bpmnkit/connector-gen"
import { readFileSync, writeFileSync } from "node:fs"

const spec = readFileSync("openapi.yaml", "utf8")
const templates = generateConnectorTemplates(spec)

for (const template of templates) {
  writeFileSync(`${template.id}.json`, JSON.stringify(template, null, 2))
  console.log(`Generated: ${template.name}`)
}
```

## CLI usage (via `@bpmnkit/cli`)

```sh
casen connector generate openapi.yaml --out ./templates/
```

## API Reference

```typescript
function generateConnectorTemplates(
  spec: string,            // YAML or JSON OpenAPI/Swagger spec
  options?: GenerateOptions
): ConnectorTemplate[]

interface GenerateOptions {
  filter?: {
    paths?: string[]       // include only these path prefixes
    methods?: string[]     // e.g. ["get", "post"]
  }
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
| [`@bpmnkit/ascii`](https://www.npmjs.com/package/@bpmnkit/ascii) | Render BPMN diagrams as Unicode ASCII art |
| [`@bpmnkit/ui`](https://www.npmjs.com/package/@bpmnkit/ui) | Shared design tokens and UI components |
| [`@bpmnkit/profiles`](https://www.npmjs.com/package/@bpmnkit/profiles) | Shared auth, profile storage, and client factories for CLI & proxy |
| [`@bpmnkit/operate`](https://www.npmjs.com/package/@bpmnkit/operate) | Monitoring & operations frontend for Camunda clusters |
| [`@bpmnkit/cli`](https://www.npmjs.com/package/@bpmnkit/cli) | Camunda 8 command-line interface (casen) |
| [`@bpmnkit/proxy`](https://www.npmjs.com/package/@bpmnkit/proxy) | Local AI bridge and Camunda API proxy server |
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
