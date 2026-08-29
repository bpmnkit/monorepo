---
title: Installation
description: Install BPMN Kit packages in your project.
sidebar:
  order: 1
---

BPMN Kit is a collection of focused packages. Install only what you need.

## Core SDK

The `@bpmnkit/core` package is the foundation — it provides the fluent process builder,
BPMN 2.0 parser/serializer, auto-layout, and the AI-compact format.

```sh
pnpm add @bpmnkit/core
# or
npm install @bpmnkit/core
# or
yarn add @bpmnkit/core
```

## Simulation Engine

To run BPMN processes locally (browser or Node.js):

```sh
pnpm add @bpmnkit/engine
```

## Camunda 8 REST API Client

To interact with a live Camunda 8 cluster:

```sh
pnpm add @bpmnkit/api
```

## SVG Canvas Viewer

To embed an interactive BPMN diagram viewer in a web page:

```sh
pnpm add @bpmnkit/canvas
```

## Full Editor

The editor bundles the canvas, a properties panel, and an AI bridge:

```sh
pnpm add @bpmnkit/editor
```

## CLI

The `casen` CLI is a standalone tool — install it globally:

```sh
pnpm add -g @bpmnkit/cli
```

With the CLI installed, you can use the AI-first workflow to implement processes from natural
language using Claude Code:

```sh
casen skills install   # install /implement, /review, /test, /deploy slash commands
casen proxy            # start the AI bridge
casen reebe            # start local workflow engine
```

Then in Claude Code: `/implement an invoice approval process`

See [AI-Driven Implementation](/docs/guides/ai-implement) for a full walkthrough.

## Worker client

For standalone workers that connect to Zeebe without the full SDK:

```sh
npm install @bpmnkit/worker-client
```

Workers scaffolded by `/implement` depend only on this package at runtime.

## TypeScript Requirements

All packages require **TypeScript 5.0+** with `strict: true`. The recommended `tsconfig.json` settings:

```json
{
  "compilerOptions": {
    "strict": true,
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "target": "ES2022"
  }
}
```

For browser/bundler projects (Vite, Webpack, etc.), use:

```json
{
  "compilerOptions": {
    "strict": true,
    "module": "ESNext",
    "moduleResolution": "bundler"
  }
}
```

## Runtime Requirements

| Runtime | Minimum Version |
|---|---|
| Node.js | 20 LTS |
| Deno | 1.40+ |
| Bun | 1.0+ |
| Browsers | ES2022 (Chrome 94, Firefox 93, Safari 15.4) |

All packages are **ESM-only** (`"type": "module"`). CommonJS is not supported.
