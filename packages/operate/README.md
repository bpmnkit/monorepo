<div align="center">
  <a href="https://bpmnkit.com"><img src="https://bpmnkit.com/favicon.svg" width="72" height="72" alt="BPMN Kit logo"></a>
  <h1>@bpmnkit/operate</h1>
  <p>Lightweight monitoring and operations UI for Camunda 8 dev clusters, C8 Run and SaaS trials</p>

  [![npm](https://img.shields.io/npm/v/@bpmnkit/operate?style=flat-square&color=6244d7)](https://www.npmjs.com/package/@bpmnkit/operate)
  [![license](https://img.shields.io/npm/l/@bpmnkit/operate?style=flat-square)](https://github.com/bpmnkit/monorepo/blob/main/LICENSE)
  [![typescript](https://img.shields.io/badge/TypeScript-strict-6244d7?style=flat-square&logo=typescript&logoColor=white)](https://github.com/bpmnkit/monorepo)
  [![ai-assisted](https://img.shields.io/badge/AI--assisted-claude-8b5cf6?style=flat-square)](https://github.com/bpmnkit/monorepo)
  [![tier: experimental](https://img.shields.io/badge/tier-experimental-d97706?style=flat-square)](https://bpmnkit.com/docs/getting-started/stability#product-tiers)

  [Website](https://bpmnkit.com) · [Documentation](https://bpmnkit.com/docs) · [GitHub](https://github.com/bpmnkit/monorepo) · [Changelog](https://github.com/bpmnkit/monorepo/blob/main/packages/operate/CHANGELOG.md)
</div>

> **Experimental tier.** May change or be discontinued. Not for production. See [product tiers](https://bpmnkit.com/docs/getting-started/stability#product-tiers).

---

## Overview

`@bpmnkit/operate` is a small, Operate-like web UI for a Camunda 8 cluster. Mount it into any element to get a dashboard and lists of process definitions, decisions, instances, incidents, jobs and user tasks, with detail pages that draw the BPMN diagram. It is built for development clusters, Camunda 8 Run and SaaS trial clusters — not as a replacement for Camunda Operate in production.

The UI does not call the cluster directly. It polls the BPMN Kit proxy (`@bpmnkit/proxy`, started with `casen proxy start`), which holds your connection profiles and credentials and adds the auth header to each Camunda request. The browser never sees a credential.

A **mock mode** (`mock: true`) ships fixture data and makes no network calls — useful for demos and UI work.

## Features

- **Dashboard** — active instances, open incidents, active jobs, pending tasks, deployed processes
- **Processes & decisions** — definitions grouped by id with version counts; BPMN diagram / DMN table on the detail page
- **Instances** — state filter (Active / Completed / Terminated), root-process filter, parent-chain breadcrumbs, diagram with active and completed elements, variables, cancel
- **Incidents** — state filter, retry job (sets retries to 3), resolve incident
- **Jobs and user tasks** — searchable, sortable tables; task form preview
- **Messages & signals** — publish / correlate a message, broadcast a signal, list active subscriptions
- **Start instance** — with business ID and JSON variables
- **Profile switcher** — every proxy profile in the header; switching reloads the view
- **Errors on screen** — a failed poll shows its reason (e.g. `HTTP 401: No active profile`) and keeps the last good data
- **Hash router** — `#/`, `#/instances`, `#/instances/:key`, `#/definitions`, … works from any static host

**Not included** (use Camunda Operate): variable editing, instance modification and migration, batch operations, decision instance history, deletion, result sets beyond 1000 items per list, access-control UI.

## Installation

```sh
npm install @bpmnkit/operate
npm install -g @bpmnkit/cli   # casen proxy start, casen profile
```

## Quick Start

### Demo mode (no cluster needed)

```typescript
import { createOperate } from "@bpmnkit/operate"

createOperate({
  container: document.getElementById("app")!,
  mock: true,
})
```

### Camunda 8 Run

```sh
casen profile create c8run --base-url http://localhost:8080/v2 --auth-type none
casen profile use c8run
casen proxy start   # http://localhost:3033
```

### Camunda SaaS

Create client credentials in the Camunda Console, download the credentials file, then:

```sh
casen profile import saas ./camunda-credentials.sh
casen profile use saas
casen proxy start
```

### Mount against the proxy

```typescript
import { createOperate } from "@bpmnkit/operate"

createOperate({
  container: document.getElementById("app")!,
  proxyUrl: "http://localhost:3033", // default; may be relative behind a same-origin reverse proxy
  profile: "c8run",                  // optional; the proxy's active profile if omitted
  pollInterval: 15_000,              // default 30 000 ms, minimum 5 000, 0 = load once
})
```

The proxy acts with the stored credentials, so it only answers browser origins it trusts: bpmnkit.com, Studio, the desktop app and any `localhost` origin. To mount Operate on another origin, start the proxy with `casen proxy start --allow-origin https://your.app`.

## API Reference

### `createOperate(options)`

```typescript
interface OperateOptions {
  container: HTMLElement
  proxyUrl?: string        // default: "http://localhost:3033"
  profile?: string         // default: the proxy's active profile
  theme?: "light" | "dark" | "auto" | "neon"  // default: "light"; a theme picked in the header wins
  pollInterval?: number    // ms; default 30 000, minimum 5 000, 0 = no auto-refresh
  mock?: boolean           // built-in fixture data; default false
  onOpenInEditor?: (xml: string, name: string) => void  // adds "Open in Editor" to diagrams
}
```

Returns an `OperateApi`:

```typescript
interface OperateApi {
  readonly el: HTMLElement
  setProfile(name: string | null): void  // reloads the current view
  setTheme(theme: "light" | "dark" | "auto" | "neon"): void
  navigate(path: string): void           // e.g. "/instances/2251799813690001"
  destroy(): void
}
```

The detail views and stores (`createInstanceDetailView`, `InstancesStore`, …) are also exported for BPMN Kit Studio. They are `@internal` and may change in any release.

Full guide: [bpmnkit.com/docs/packages/operate](https://bpmnkit.com/docs/packages/operate)

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
| [`@bpmnkit/markdown`](https://www.npmjs.com/package/@bpmnkit/markdown) | BPMN diagrams in Markdown — remark, markdown-it and README pre-rendering |
| [`@bpmnkit/docspack`](https://www.npmjs.com/package/@bpmnkit/docspack) | BPMN Kit docs as an offline docspack package for AI agents |
| [`@bpmnkit/camunda-docspack`](https://www.npmjs.com/package/@bpmnkit/camunda-docspack) | Camunda 8 docs as an offline docspack package for AI agents |
| [`@bpmnkit/ui`](https://www.npmjs.com/package/@bpmnkit/ui) | Shared design tokens and UI components |
| [`@bpmnkit/profiles`](https://www.npmjs.com/package/@bpmnkit/profiles) | Shared auth, profile storage, and client factories for CLI & proxy |
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
