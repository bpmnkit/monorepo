<div align="center">
  <a href="https://bpmnkit.com"><img src="https://bpmnkit.com/favicon.svg" width="72" height="72" alt="BPMN Kit logo"></a>
  <h1>@bpmnkit/cli-sdk</h1>
  <p>Plugin authoring SDK for the casen CLI — types, contracts, and helpers</p>

  [![npm](https://img.shields.io/npm/v/@bpmnkit/cli-sdk?style=flat-square&color=6244d7)](https://www.npmjs.com/package/@bpmnkit/cli-sdk)
  [![license](https://img.shields.io/npm/l/@bpmnkit/cli-sdk?style=flat-square)](https://github.com/bpmnkit/monorepo/blob/main/LICENSE)
  [![typescript](https://img.shields.io/badge/TypeScript-strict-6244d7?style=flat-square&logo=typescript&logoColor=white)](https://github.com/bpmnkit/monorepo)

  [Website](https://bpmnkit.com) · [Documentation](https://docs.bpmnkit.com) · [GitHub](https://github.com/bpmnkit/monorepo) · [Changelog](https://github.com/bpmnkit/monorepo/blob/main/packages/cli-sdk/CHANGELOG.md)
</div>

---

## Overview

`@bpmnkit/cli-sdk` is the official SDK for building `casen` CLI plugins. It exports the `CasenPlugin` contract and all supporting types (`CommandGroup`, `Command`, `RunContext`, `OutputWriter`) so you can build typed, TUI-integrated plugins without depending on casen internals.

## Installation

Install as a `devDependency` in your plugin package:

```sh
pnpm add -D @bpmnkit/cli-sdk
npm install --save-dev @bpmnkit/cli-sdk
```

## Quick Start

```typescript
import type { CasenPlugin } from "@bpmnkit/cli-sdk"

const plugin: CasenPlugin = {
  id: "com.example.casen-hello",
  name: "Hello",
  version: "0.1.0",
  groups: [
    {
      name: "hello",
      description: "Say hello",
      commands: [
        {
          name: "world",
          description: "Print a greeting",
          async run(ctx) {
            ctx.output.ok("Hello, world!")
          },
        },
      ],
    },
  ],
}

export default plugin
```

## API Reference

### `CasenPlugin`

The top-level contract every plugin must export as its default export.

```typescript
interface CasenPlugin {
  /** Unique reverse-domain identifier, e.g. "com.acme.casen-deploy" */
  id: string
  /** Human-readable name shown in `casen plugin list` */
  name: string
  version: string
  /** Command groups this plugin contributes to the CLI */
  groups: CommandGroup[]
}
```

### `CommandGroup`

Maps to a single top-level token: `casen <group>`.

```typescript
interface CommandGroup {
  name: string          // kebab-case, e.g. "my-integration"
  aliases?: string[]
  description: string
  commands: Command[]
}
```

### `Command`

```typescript
interface Command {
  name: string
  aliases?: string[]
  description: string
  args?: ArgSpec[]
  flags?: FlagSpec[]
  examples?: Example[]
  run(ctx: RunContext): Promise<void>
}
```

### `RunContext`

Passed to every `run()` function.

```typescript
interface RunContext {
  positional: string[]
  flags: ParsedFlags
  output: OutputWriter
  /** Returns a Camunda C8 REST client. Cast to `CamundaClient` from `@bpmnkit/api`. */
  getClient(): Promise<unknown>
  getAdminClient(): Promise<unknown>
}
```

### `OutputWriter`

```typescript
interface OutputWriter {
  readonly format: "table" | "json" | "yaml"
  readonly isInteractive: boolean
  printList(data: unknown, columns: ColumnDef[]): void
  printItem(data: unknown): void
  print(data: unknown): void
  ok(msg: string): void    // ✓ message
  info(msg: string): void  // → message
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
| [`@bpmnkit/connector-gen`](https://www.npmjs.com/package/@bpmnkit/connector-gen) | Generate connector templates from OpenAPI specs |
| [`@bpmnkit/cli`](https://www.npmjs.com/package/@bpmnkit/cli) | Camunda 8 command-line interface (casen) |
| [`@bpmnkit/proxy`](https://www.npmjs.com/package/@bpmnkit/proxy) | Local AI bridge and Camunda API proxy server |
| [`@bpmnkit/create-casen-plugin`](https://www.npmjs.com/package/@bpmnkit/create-casen-plugin) | Scaffold a new casen CLI plugin in seconds |
| [`@bpmnkit/casen-report`](https://www.npmjs.com/package/@bpmnkit/casen-report) | HTML reports from Camunda 8 incident and SLA data |
| [`@bpmnkit/casen-worker-http`](https://www.npmjs.com/package/@bpmnkit/casen-worker-http) | Example HTTP worker plugin — completes jobs with live JSONPlaceholder API data |
| [`@bpmnkit/casen-worker-ai`](https://www.npmjs.com/package/@bpmnkit/casen-worker-ai) | AI task worker — classify, summarize, extract, and decide using Claude |

## License

[MIT](https://github.com/bpmnkit/monorepo/blob/main/LICENSE) © BPMN Kit — made by [u11g](https://u11g.com)

<div align="center">
  <a href="https://bpmnkit.com"><img src="https://bpmnkit.com/favicon.svg" width="32" height="32" alt="BPMN Kit"></a>
</div>
