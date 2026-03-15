<div align="center">
  <img src="https://raw.githubusercontent.com/bpmn-sdk/monorepo/main/doc/logos/logo-2-gateway.svg" width="72" height="72" alt="BPMN Kit logo">
  <h1>@bpmnkit/api</h1>
  <p>TypeScript client for the Camunda 8 REST API — 180 typed operations, OAuth2, retries, and caching</p>

  [![npm](https://img.shields.io/npm/v/@bpmnkit/api?style=flat-square&color=6244d7)](https://www.npmjs.com/package/@bpmnkit/api)
  [![license](https://img.shields.io/npm/l/@bpmnkit/api?style=flat-square)](https://github.com/bpmnkit/monorepo/blob/main/LICENSE)
  [![typescript](https://img.shields.io/badge/TypeScript-strict-6244d7?style=flat-square&logo=typescript&logoColor=white)](https://github.com/bpmnkit/monorepo)

  [Documentation](https://bpmn-sdk-docs.pages.dev) · [GitHub](https://github.com/bpmnkit/monorepo) · [Changelog](https://github.com/bpmnkit/monorepo/blob/main/packages/api/CHANGELOG.md)
</div>

---

## Overview

`@bpmnkit/api` is a fully typed TypeScript SDK for the [Camunda 8 Orchestration Cluster REST API v2](https://docs.camunda.io/docs/apis-tools/camunda-api-rest/camunda-api-rest-overview/). Every endpoint, request body, and response shape is typed end-to-end.

## Features

- **180 typed operations** across 30+ resource namespaces
- **502 TypeScript types** generated from the official OpenAPI spec
- **Authentication** — Bearer token, OAuth2 (auto-refresh), HTTP Basic
- **Retries** — configurable exponential backoff with jitter
- **Caching** — in-memory LRU + TTL cache for read operations
- **Events** — subscribe to request, response, error, retry, and cache events
- **Structured logging** — pluggable logger with configurable levels
- **Config resolution** — constructor → YAML file → environment variables
- **Token persistence** — disk cache for OAuth2 access tokens
- **Zero runtime dependencies**

## Installation

```sh
npm install @bpmnkit/api
```

## Quick Start

```typescript
import { CamundaClient } from "@bpmnkit/api"

const client = new CamundaClient({
  baseUrl: "https://cluster.camunda.io",
  auth: {
    type: "oauth2",
    clientId: process.env.CAMUNDA_CLIENT_ID!,
    clientSecret: process.env.CAMUNDA_CLIENT_SECRET!,
    tokenUrl: "https://login.cloud.camunda.io/oauth/token",
    audience: "zeebe.camunda.io",
  },
})

// Deploy a process
await client.deployment.create({
  resources: [{ name: "order.bpmn", content: bpmnXml }],
})

// Start a process instance
const instance = await client.processInstance.create({
  processDefinitionId: "order-process",
  variables: { orderId: "ORD-001", amount: 99.99 },
})

// Complete a user task
const tasks = await client.userTask.search({
  filter: { processInstanceKey: instance.processInstanceKey },
})
await client.userTask.complete(tasks.items[0].userTaskKey, {
  variables: { approved: true },
})
```

## Authentication

```typescript
// OAuth2 (recommended for Camunda Cloud)
const client = new CamundaClient({
  baseUrl: "...",
  auth: { type: "oauth2", clientId: "...", clientSecret: "...", tokenUrl: "...", audience: "..." },
})

// Bearer token (static)
const client = new CamundaClient({
  baseUrl: "...",
  auth: { type: "bearer", token: "..." },
})

// HTTP Basic
const client = new CamundaClient({
  baseUrl: "...",
  auth: { type: "basic", username: "...", password: "..." },
})
```

## Resource Namespaces

| Namespace | Description |
|-----------|-------------|
| `client.processInstance` | CRUD + cancel + variables |
| `client.processDefinition` | Definitions, XML, start forms |
| `client.deployment` | Create, list, delete deployments |
| `client.job` | Activate, complete, fail, update |
| `client.userTask` | Search, complete, assign, update |
| `client.decisionDefinition` | List, XML, evaluate |
| `client.decisionInstance` | Search, get |
| `client.message` | Publish, correlate |
| `client.signal` | Broadcast |
| `client.incident` | Search, resolve |
| `client.variable` | Search, get |
| `client.flowNodeInstance` | Search, get |
| `client.user` | Search, create, update |
| `client.role` | Search, create, assign |
| `client.group` | Search, create, assign |
| `client.authorization` | Manage permissions |
| `client.tenant` | Multi-tenant management |
| `client.clock` | Time manipulation (testing) |

## Error Handling

```typescript
import { CamundaNotFoundError, CamundaRateLimitError } from "@bpmnkit/api"

try {
  await client.processInstance.get(key)
} catch (err) {
  if (err instanceof CamundaNotFoundError) console.log("Not found")
  if (err instanceof CamundaRateLimitError) console.log("Rate limited")
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
| [`@bpmnkit/ascii`](https://www.npmjs.com/package/@bpmnkit/ascii) | Render BPMN diagrams as Unicode ASCII art |
| [`@bpmnkit/profiles`](https://www.npmjs.com/package/@bpmnkit/profiles) | Shared auth, profile storage, and client factories for CLI & proxy |
| [`@bpmnkit/operate`](https://www.npmjs.com/package/@bpmnkit/operate) | Monitoring & operations frontend for Camunda clusters |

## License

[MIT](https://github.com/bpmnkit/monorepo/blob/main/LICENSE) © bpmn-sdk
