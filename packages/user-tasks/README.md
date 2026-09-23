<div align="center">
  <a href="https://bpmnkit.com"><img src="https://bpmnkit.com/favicon.svg" width="72" height="72" alt="BPMN Kit logo"></a>
  <h1>@bpmnkit/user-tasks</h1>
  <p>Embeddable user task widget for Camunda 8 — form rendering, claim/complete actions, zero dependencies</p>

  [![npm](https://img.shields.io/npm/v/@bpmnkit/user-tasks?style=flat-square&color=6244d7)](https://www.npmjs.com/package/@bpmnkit/user-tasks)
  [![license](https://img.shields.io/npm/l/@bpmnkit/user-tasks?style=flat-square)](https://github.com/bpmnkit/monorepo/blob/main/LICENSE)
  [![typescript](https://img.shields.io/badge/TypeScript-strict-6244d7?style=flat-square&logo=typescript&logoColor=white)](https://github.com/bpmnkit/monorepo)
  [![ai-assisted](https://img.shields.io/badge/AI--assisted-claude-8b5cf6?style=flat-square)](https://github.com/bpmnkit/monorepo)
  [![experimental](https://img.shields.io/badge/status-experimental-f59e0b?style=flat-square)](https://bpmnkit.com/docs/getting-started/stability)

  [Website](https://bpmnkit.com) · [Documentation](https://bpmnkit.com/docs) · [GitHub](https://github.com/bpmnkit/monorepo) · [Changelog](https://github.com/bpmnkit/monorepo/blob/main/packages/user-tasks/CHANGELOG.md)
</div>

---

## Overview

`@bpmnkit/user-tasks` renders a Camunda 8 user task, and the actions that go with it, into any
HTML element. Mount it and you get the task's linked Camunda Form, its metadata, and buttons for
claim, complete and — when you ask for it — reject.

It talks to a running [`@bpmnkit/proxy`](https://www.npmjs.com/package/@bpmnkit/proxy), which
holds the credentials and forwards to the Camunda REST API, so no cluster secret reaches the page.

## Features

- **Form rendering** — loads the task's linked Camunda Form and renders it through `@bpmnkit/plugins/form-viewer`
- **Claim / unclaim** — sets or clears the task assignee
- **Complete** — submits the form's collected variables
- **Reject** — an optional return action with a reason; the button is hidden unless you pass `onReject`
- **Metadata** — assignee, priority, and a due date that highlights once it is overdue
- **Themed** — `light`, `dark`, `auto` or `neon`, drawn with the `@bpmnkit/ui` design tokens
- **No framework** — a function and an `HTMLElement`; it works inside React, Vue, Astro or a plain page

## Installation

```sh
npm install @bpmnkit/user-tasks
```

## Quick Start

```typescript
import { createUserTaskWidget } from "@bpmnkit/user-tasks"

const widget = createUserTaskWidget({
  container: document.getElementById("task-panel")!,
  task: {
    userTaskKey: "2251799813685281",
    name: "Review order",
    assignee: "alice",
    dueDate: "2025-06-01T12:00:00Z",
    priority: 50,
  },
  proxyUrl: "http://localhost:3033", // default
  theme: "dark",
  onComplete(variables) {
    console.log("Task completed with", variables)
  },
  onClaim() {
    console.log("Task claimed")
  },
  onUnclaim() {
    console.log("Task unclaimed")
  },
  onReject(reason) {
    console.log("Task rejected:", reason)
  },
})

// Show a different task in the same widget — the form reloads.
widget.setTask({ userTaskKey: "2251799813685999", name: "Approve invoice" })

// Remove it from the DOM.
widget.destroy()
```

## API Reference

### `createUserTaskWidget(options)`

```typescript
interface UserTaskWidgetOptions {
  /** The container element to render the widget into. */
  container: HTMLElement
  /** The user task to display. */
  task: UserTask
  /** Base URL of the proxy server. Default: "http://localhost:3033" */
  proxyUrl?: string
  /** Active profile name, sent as the x-profile header. */
  profile?: string | null
  /** Visual theme (`Theme` from @bpmnkit/ui). Default: "neon" */
  theme?: "light" | "dark" | "auto" | "neon"
  /** Called when the user completes the task. */
  onComplete(variables: Record<string, unknown>): void
  /** Called when the user claims the task. */
  onClaim(): void
  /** Called when the user unclaims the task. */
  onUnclaim(): void
  /** Called when the user rejects the task. Omit to hide the Reject button. */
  onReject?(reason: string): void
}
```

Returns a `UserTaskWidgetApi`:

```typescript
interface UserTaskWidgetApi {
  /** Show a different task and reload its form. */
  setTask(task: UserTask): void
  /** Remove the widget from the DOM and clean up. */
  destroy(): void
}
```

### `UserTask`

```typescript
interface UserTask {
  userTaskKey: string
  name?: string
  assignee?: string
  candidateGroups?: string[]
  dueDate?: string // ISO 8601
  priority?: number
  processInstanceKey?: string
  processDefinitionKey?: string
  formKey?: string
}
```

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
| [`@bpmnkit/docspack`](https://www.npmjs.com/package/@bpmnkit/docspack) | BPMN Kit docs as an offline docspack package for AI agents |
| [`@bpmnkit/camunda-docspack`](https://www.npmjs.com/package/@bpmnkit/camunda-docspack) | Camunda 8 docs as an offline docspack package for AI agents |
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
