<div align="center">
  <a href="https://bpmnkit.com"><img src="https://bpmnkit.com/favicon.svg" width="72" height="72" alt="BPMN Kit logo"></a>
  <h1>@bpmnkit/connectors</h1>
  <p>Camunda 8 out-of-the-box connector catalog and deterministic element-template application for @bpmnkit/core</p>

  [![npm](https://img.shields.io/npm/v/@bpmnkit/connectors?style=flat-square&color=6244d7)](https://www.npmjs.com/package/@bpmnkit/connectors)
  [![license](https://img.shields.io/npm/l/@bpmnkit/connectors?style=flat-square)](https://github.com/bpmnkit/monorepo/blob/main/LICENSE)
  [![typescript](https://img.shields.io/badge/TypeScript-strict-6244d7?style=flat-square&logo=typescript&logoColor=white)](https://github.com/bpmnkit/monorepo)
  [![ai-assisted](https://img.shields.io/badge/AI--assisted-claude-8b5cf6?style=flat-square)](https://github.com/bpmnkit/monorepo)
  [![experimental](https://img.shields.io/badge/status-experimental-f59e0b?style=flat-square)](https://github.com/bpmnkit/monorepo)

  [Website](https://bpmnkit.com) · [Documentation](https://docs.bpmnkit.com) · [GitHub](https://github.com/bpmnkit/monorepo) · [Changelog](https://github.com/bpmnkit/monorepo/blob/main/packages/connectors/CHANGELOG.md)
</div>

---

## Overview

`@bpmnkit/connectors` bundles the 116+ Camunda 8 out-of-the-box connector element templates (Slack, SendGrid, HTTP, Kafka, AWS, the agentic-AI family, and more) and applies them to `@bpmnkit/core` builder options deterministically — every binding kind (`zeebe:input`, `zeebe:output`, `zeebe:taskHeader`, `zeebe:taskDefinition`, `zeebe:property`, `zeebe:adHoc`), dropdown-gated conditions, required-field validation, and FEEL parse-checking on FEEL-tagged values.

## Features

- **Full connector catalog** — search and inspect all bundled Camunda 8 OOTB templates
- **Complete binding resolution** — including `zeebe:property` and `zeebe:output`, which naive appliers drop
- **Required-field and FEEL validation** — problems are reported, never silently swallowed
- **Works with any template** — bundled catalog or a custom/generated `ElementTemplate`

## Installation

```sh
npm install @bpmnkit/connectors
```

## Quick Start

```typescript
import { Bpmn } from "@bpmnkit/core"
import { applyConnectorTemplate, searchConnectors } from "@bpmnkit/connectors"

const [slack] = searchConnectors("slack")
const result = applyConnectorTemplate(slack.id, {
  method: "chat.postMessage",
  token: "{{secrets.SLACK_OAUTH_TOKEN}}",
  "data.channel": "#ops",
  "data.text": "=\"Order \" + orderId + \" failed validation\"",
})

if (result.problems.length > 0) throw new Error(result.problems[0].message)

const defs = Bpmn.createProcess("proc")
  .startEvent("s")
  .serviceTask("notify", result.serviceTask!)
  .endEvent("e")
  .build()
```

## API Reference

```typescript
function listConnectors(): ConnectorSummary[]
function searchConnectors(query: string): ConnectorSummary[]
function getTemplate(id: string): ElementTemplate | undefined

function applyConnectorTemplate(templateId: string, values?: Record<string, string>): ApplyResult
function applyElementTemplate(template: ElementTemplate, values?: Record<string, string>): ApplyResult

interface ApplyResult {
  serviceTask?: ServiceTaskOptions
  adHocSubProcess?: Partial<AdHocSubProcessOptions>
  startEvent?: Partial<StartEventOptions>
  boundaryEvent?: Partial<BoundaryEventOptions>
  intermediateEvent?: Partial<IntermediateCatchEventOptions>
  problems: ApplyProblem[]
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
| [`@bpmnkit/docspack`](https://www.npmjs.com/package/@bpmnkit/docspack) | BPMN Kit docs as an offline docspack package for AI agents |
| [`@bpmnkit/ui`](https://www.npmjs.com/package/@bpmnkit/ui) | Shared design tokens and UI components |
| [`@bpmnkit/profiles`](https://www.npmjs.com/package/@bpmnkit/profiles) | Shared auth, profile storage, and client factories for CLI & proxy |
| [`@bpmnkit/operate`](https://www.npmjs.com/package/@bpmnkit/operate) | Monitoring & operations frontend for Camunda clusters |
| [`@bpmnkit/connector-gen`](https://www.npmjs.com/package/@bpmnkit/connector-gen) | Generate connector templates from OpenAPI specs |
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
