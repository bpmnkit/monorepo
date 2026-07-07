<div align="center">
  <a href="https://bpmnkit.com"><img src="https://bpmnkit.com/favicon.svg" width="72" height="72" alt="BPMN Kit logo"></a>
  <h1>@bpmnkit/patterns</h1>
  <p>Domain process patterns for BPMNKit AIKit — compact BPMN templates and worker specs for common business processes</p>

  [![npm](https://img.shields.io/npm/v/@bpmnkit/patterns?style=flat-square&color=6244d7)](https://www.npmjs.com/package/@bpmnkit/patterns)
  [![license](https://img.shields.io/npm/l/@bpmnkit/patterns?style=flat-square)](https://github.com/bpmnkit/monorepo/blob/main/LICENSE)
  [![typescript](https://img.shields.io/badge/TypeScript-strict-6244d7?style=flat-square&logo=typescript&logoColor=white)](https://github.com/bpmnkit/monorepo)
  [![ai-assisted](https://img.shields.io/badge/AI--assisted-claude-8b5cf6?style=flat-square)](https://github.com/bpmnkit/monorepo)
  [![experimental](https://img.shields.io/badge/status-experimental-f59e0b?style=flat-square)](https://github.com/bpmnkit/monorepo)

  [Website](https://bpmnkit.com) · [Documentation](https://docs.bpmnkit.com) · [GitHub](https://github.com/bpmnkit/monorepo) · [Changelog](https://github.com/bpmnkit/monorepo/blob/main/packages/patterns/CHANGELOG.md)
</div>

---

## Overview

`@bpmnkit/patterns` is the domain knowledge library for the BPMNKit AIKit. When Claude runs the `/implement` skill, it calls `pattern_list` to check for a matching domain pattern and loads the relevant template and worker specs as context before generating a BPMN process.

Patterns are hints, not rigid templates. Claude adapts them to the user's specific request, or ignores them entirely when the request doesn't match any known domain.

## Features

- **7 seed patterns** — invoice-approval, employee-onboarding, supplier-contract-review, incident-response, loan-origination, content-moderation, order-fulfillment
- **Rich domain context** — each pattern includes a README with conventions, regulations, and common variations
- **Worker specs** — typical service tasks with job types, typed inputs/outputs, and real integration options
- **Compact BPMN templates** — token-efficient starting-point structure for LLM-based generation
- **Keyword matching** — `findPattern(query)` scores keyword hits to find the best-fit pattern from a free-text description

## Installation

```sh
npm install @bpmnkit/patterns
```

## Quick Start

```typescript
import { ALL_PATTERNS, findPattern } from "@bpmnkit/patterns"

// List all available patterns
console.log(ALL_PATTERNS.map((p) => p.id))
// ["invoice-approval", "employee-onboarding", ...]

// Find by keyword match
const pattern = findPattern("employee onboarding workflow with Okta")
console.log(pattern?.id)        // "employee-onboarding"
console.log(pattern?.workers)   // [{jobType: "create-accounts", ...}, ...]

// Find by exact ID
const invoice = findPattern("invoice-approval")
console.log(invoice?.readme)    // domain context for the LLM
```

## Available Patterns

| ID | Domain | Typical Workers |
|----|--------|-----------------|
| `invoice-approval` | Finance / accounts payable | validate-invoice, check-duplicate, notify-approver, trigger-payment |
| `employee-onboarding` | HR | create-accounts, send-welcome-email, create-jira-ticket, schedule-orientation |
| `supplier-contract-review` | Procurement / legal | classify-contract, risk-scan, store-in-clm, request-esignature |
| `incident-response` | IT / ops | classify-incident, page-oncall, create-incident-channel, update-status-page |
| `loan-origination` | Financial services | verify-identity, credit-check, risk-scoring, generate-offer, disburse-funds |
| `content-moderation` | Trust & safety | ai-scan, apply-action, report-csam, notify-user |
| `order-fulfillment` | E-commerce | validate-inventory, process-payment, create-warehouse-order, create-shipment |

## API Reference

```typescript
// All patterns
export const ALL_PATTERNS: Pattern[]

// Find by exact ID or keyword match (returns best match or undefined)
export function findPattern(query: string): Pattern | undefined

// Pattern schema
export interface Pattern {
  id: string
  name: string
  description: string
  keywords: string[]
  readme: string                 // domain context text for the LLM
  workers: WorkerSpec[]
  variations: string[]
  template: PatternTemplate      // compact BPMN structure
}

export interface WorkerSpec {
  name: string
  jobType: string
  description: string
  inputs: Record<string, string>
  outputs: Record<string, string>
  integrationOptions?: string[]  // e.g. ["Stripe", "Adyen", "Braintree"]
}
```

## Used by AIKit

This package is consumed by the BPMNKit AIKit MCP server (`@bpmnkit/proxy`). When Claude Code runs `/implement`, it calls the `pattern_list` and `pattern_get` MCP tools which delegate to this library.

See the [Pattern Library guide](https://docs.bpmnkit.com/guides/patterns/) for a full walkthrough.

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
| [`@bpmnkit/connectors`](https://www.npmjs.com/package/@bpmnkit/connectors) | Camunda 8 OOTB connector catalog and deterministic template application |
| [`@bpmnkit/cli`](https://www.npmjs.com/package/@bpmnkit/cli) | Camunda 8 command-line interface (casen) |
| [`@bpmnkit/proxy`](https://www.npmjs.com/package/@bpmnkit/proxy) | Local AI bridge and Camunda API proxy server |
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
