<div align="center">
  <a href="https://bpmnkit.com"><img src="https://bpmnkit.com/favicon.svg" width="72" height="72" alt="BPMN Kit logo"></a>
  <h1>@bpmnkit/reebe-wasm</h1>
  <p>WebAssembly BPMN workflow engine — runs the Reebe engine in the browser</p>

  [![npm](https://img.shields.io/npm/v/@bpmnkit/reebe-wasm?style=flat-square&color=6244d7)](https://www.npmjs.com/package/@bpmnkit/reebe-wasm)
  [![license](https://img.shields.io/npm/l/@bpmnkit/reebe-wasm?style=flat-square)](https://github.com/bpmnkit/monorepo/blob/main/LICENSE)
  [![typescript](https://img.shields.io/badge/TypeScript-strict-6244d7?style=flat-square&logo=typescript&logoColor=white)](https://github.com/bpmnkit/monorepo)
  [![ai-assisted](https://img.shields.io/badge/AI--assisted-claude-8b5cf6?style=flat-square)](https://github.com/bpmnkit/monorepo)
  [![experimental](https://img.shields.io/badge/status-experimental-f59e0b?style=flat-square)](https://github.com/bpmnkit/monorepo)

  [Website](https://bpmnkit.com) · [Documentation](https://docs.bpmnkit.com) · [GitHub](https://github.com/bpmnkit/monorepo) · [Changelog](https://github.com/bpmnkit/monorepo/blob/main/apps/reebe-wasm/CHANGELOG.md)
</div>

---

## Overview

`@bpmnkit/reebe-wasm` is the WebAssembly build of the [Reebe](https://github.com/bpmnkit/monorepo) BPMN workflow engine, compiled from Rust via [wasm-pack](https://rustwasm.github.io/wasm-pack/). It enables full BPMN 2.0 process execution directly in the browser — no server required.

Used internally by `@bpmnkit/engine` for the `./wasm-runner` entry point, which powers the BPMNKit Studio simulator and the `casen test` CLI command.

## Features

- **Full BPMN execution** — gateways, events, subprocesses, boundary events
- **Zero network calls** — runs entirely in the browser sandbox
- **DMN decisions** — inline decision table evaluation
- **FEEL expressions** — condition and mapping evaluation
- **WebAssembly** — near-native performance, minimal footprint

## Installation

```sh
npm install @bpmnkit/reebe-wasm
pnpm add @bpmnkit/reebe-wasm
```

> **Note:** This package is a WebAssembly binary. It requires a bundler with WASM support (Vite, Webpack 5+, or a modern Rollup config).

## Usage

Used automatically by `@bpmnkit/engine` when you import from the `./wasm-runner` subpath:

```typescript
import { runScenarioWasm } from "@bpmnkit/engine/wasm-runner"

const result = await runScenarioWasm(bpmnXml, scenario)
```

For direct usage:

```typescript
import init, { WasmEngine } from "@bpmnkit/reebe-wasm"

await init()

const engine = new WasmEngine()
engine.deploy(bpmnXml)
const instance = engine.start_instance("my-process", JSON.stringify({ orderId: "123" }))
```

## API Reference

### `WasmEngine`

| Method | Description |
|--------|-------------|
| `deploy(bpmnXml: string)` | Deploy a BPMN process definition |
| `start_instance(processId, variablesJson)` | Start a new process instance |
| `complete_job(key, variablesJson)` | Complete a service task job |
| `fail_job(key, errorMessage, retries)` | Fail a service task job |
| `get_snapshot()` | Return the current engine state as JSON |

## Build from Source

The WASM binary is compiled from the Rust crate at `apps/reebe/crates/reebe-wasm`:

```sh
# From apps/reebe/
pnpm build:wasm
```

Requires [Rust](https://rustup.rs/) and [wasm-pack](https://rustwasm.github.io/wasm-pack/).

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
