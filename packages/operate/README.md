<div align="center">
  <img src="https://raw.githubusercontent.com/bpmnkit/monorepo/main/doc/logos/2026.svg" width="72" height="72" alt="BPMN Kit logo">
  <h1>@bpmnkit/operate</h1>
  <p>Monitoring and operations frontend for Camunda 8 clusters — real-time SSE, zero dependencies</p>

  [![npm](https://img.shields.io/npm/v/@bpmnkit/operate?style=flat-square&color=6244d7)](https://www.npmjs.com/package/@bpmnkit/operate)
  [![license](https://img.shields.io/npm/l/@bpmnkit/operate?style=flat-square)](https://github.com/bpmnkit/monorepo/blob/main/LICENSE)
  [![typescript](https://img.shields.io/badge/TypeScript-strict-6244d7?style=flat-square&logo=typescript&logoColor=white)](https://github.com/bpmnkit/monorepo)

  [Website](https://bpmnkit.com) · [Documentation](https://docs.bpmnkit.com) · [GitHub](https://github.com/bpmnkit/monorepo) · [Changelog](https://github.com/bpmnkit/monorepo/blob/main/packages/operate/CHANGELOG.md)
</div>

---

## Overview

`@bpmnkit/operate` is a zero-dependency monitoring and operations frontend for Camunda 8. Mount it into any HTML element to get a full process monitoring UI — live dashboard, instance browser, incident management, job queue, and user tasks.

It pairs with the `@bpmnkit/proxy` local server, which polls the Camunda REST API server-side and pushes updates via **Server-Sent Events**. The frontend stays clean with no polling timers.

A **mock mode** (`mock: true`) ships fixture data without any running proxy or cluster — useful for demos and local development.

## Features

- **Dashboard** — real-time stats: active instances, open incidents, active jobs, pending tasks
- **Process Definitions** — deployed process list with name, version, and tenant
- **Process Instances** — paginated list with state filter (Active / Completed / Terminated)
- **Instance Detail** — BPMN canvas via `@bpmnkit/canvas` with live token-highlight overlay
- **Incidents** — error type, message, process, and resolution state
- **Jobs** — job type, worker, retries, state, error message
- **User Tasks** — name, assignee, state, due date, priority
- **Profile switcher** — header dropdown that switches all SSE streams on change
- **Mock/demo mode** — fully self-contained fixture data, no cluster required
- **Hash router** — `#/`, `#/instances`, `#/instances/:key`, `#/definitions`, etc.

## Installation

```sh
npm install @bpmnkit/operate @bpmnkit/proxy
```

## Quick Start

### Demo mode (no cluster needed)

```typescript
import { createOperate } from "@bpmnkit/operate"

createOperate({
  container: document.getElementById("app")!,
  mock: true,
  theme: "auto",
})
```

### Connected to a real Camunda cluster via proxy

```typescript
import { createOperate } from "@bpmnkit/operate"

createOperate({
  container: document.getElementById("app")!,
  proxyUrl: "http://localhost:3033",   // default
  profile: "production",               // optional, uses active profile if omitted
  pollInterval: 15_000,                // ms between server-side polls (default: 30 000)
  theme: "dark",
})
```

## API Reference

### `createOperate(options)`

```typescript
interface OperateOptions {
  container: HTMLElement
  proxyUrl?: string        // default: "http://localhost:3033"
  profile?: string         // profile name; uses active profile if omitted
  theme?: "light" | "dark" | "auto"  // default: "auto"
  pollInterval?: number    // ms between polls; default: 30 000
  mock?: boolean           // use built-in fixture data; default: false
}
```

Returns an `OperateApi`:

```typescript
interface OperateApi {
  el: HTMLElement
  setProfile(name: string | null): void
  setTheme(theme: "light" | "dark" | "auto"): void
  navigate(path: string): void  // e.g. "/instances/123456789"
  destroy(): void
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
| [`@bpmnkit/connector-gen`](https://www.npmjs.com/package/@bpmnkit/connector-gen) | Generate connector templates from OpenAPI specs |
| [`@bpmnkit/cli`](https://www.npmjs.com/package/@bpmnkit/cli) | Camunda 8 command-line interface (casen) |
| [`@bpmnkit/proxy`](https://www.npmjs.com/package/@bpmnkit/proxy) | Local AI bridge and Camunda API proxy server |

## License

[MIT](https://github.com/bpmnkit/monorepo/blob/main/LICENSE) © BPMN Kit — made by [u11g](https://u11g.com)
