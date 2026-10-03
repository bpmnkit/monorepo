<div align="center">
  <a href="https://bpmnkit.com"><img src="https://bpmnkit.com/favicon.svg" width="72" height="72" alt="BPMN Kit logo"></a>
  <h1>@bpmnkit/flow</h1>
  <p>Code-first durable flows — one TypeScript definition yields the BPMN, the job types, the message correlation and the worker</p>

  [![npm](https://img.shields.io/npm/v/@bpmnkit/flow?style=flat-square&color=6244d7)](https://www.npmjs.com/package/@bpmnkit/flow)
  [![license](https://img.shields.io/npm/l/@bpmnkit/flow?style=flat-square)](https://github.com/bpmnkit/bpmnkit/blob/main/LICENSE)
  [![typescript](https://img.shields.io/badge/TypeScript-strict-6244d7?style=flat-square&logo=typescript&logoColor=white)](https://github.com/bpmnkit/bpmnkit)
  [![ai-assisted](https://img.shields.io/badge/AI--assisted-claude-8b5cf6?style=flat-square)](https://github.com/bpmnkit/bpmnkit)
  [![tier: experimental](https://img.shields.io/badge/tier-experimental-d97706?style=flat-square)](https://bpmnkit.com/docs/getting-started/stability#product-tiers)

  [Website](https://bpmnkit.com) · [Documentation](https://bpmnkit.com/docs) · [GitHub](https://github.com/bpmnkit/bpmnkit) · [Changelog](https://github.com/bpmnkit/bpmnkit/blob/main/packages/flow/CHANGELOG.md)
</div>

> **Experimental tier.** May change or be discontinued. Not for production. See [product tiers](https://bpmnkit.com/docs/getting-started/stability#product-tiers).

---

## Overview

`@bpmnkit/flow` lets you write a durable workflow as a chain of TypeScript steps. From that one definition it derives the executable BPMN process, a job type per step, the message correlation of every wait, and a worker that serves the handler steps — so the model and the code cannot drift apart.

The engine holds the run state, not your process: an instance survives a crash or a reboot and resumes at the step it reached. That makes it a good home for agent work — let an LLM decide what to do, and let the engine remember what has been done.

## Features

- **Five step kinds** — `.run()` (a handler in your worker), `.agent()` (a coding agent from the `casen agent` workforce), `.waitFor()` (a durable message wait), `.approve()` (a Camunda user task), `.loop()` (repeat until a FEEL condition holds, at most `max` rounds, then ask a person)
- **Typed data flow** — each step's output joins the variables later steps see; reading a variable no earlier step provides, naming it as a correlation key, or using it in an agent prompt is a compile error
- **One source of truth** — `toXml()` for deployment, `jobTypes` / `agentJobTypes` for wiring, `worker()` to serve the handlers
- **At-least-once delivery** — handlers get the job key for idempotency; a throw fails the job and the engine retries it
- **Ejectable** — the BPMN is ordinary Camunda 8 BPMN; open it in any modeler

## Installation

```sh
npm install @bpmnkit/flow
```

## Quick Start

```typescript
import { writeFileSync } from "node:fs"
import { defineFlow } from "@bpmnkit/flow"

const review = defineFlow("pr-review", { name: "PR review" })
  .input<{ prKey: string }>()
  .run("fetch-diff", async ({ prKey }) => ({ diff: await gh.diff(prKey) }))
  .agent("review", { role: "pr-review", prompt: "Review this diff:\n{{diff}}", result: "verdict" })
  .waitFor("ci-green", { correlationKey: "prKey" })
  .approve("approve-merge", { candidateGroups: "maintainers" })
  .run("merge", async ({ prKey, verdict }) => ({ merged: await gh.merge(prKey, verdict) }))
  .build()

writeFileSync("pr-review.bpmn", review.toXml())  // deploy with `casen deploy`
const worker = review.worker()                    // serves fetch-diff and merge
```

The `review` step is served by the agent workforce: `casen agent hire claude --roles pr-review -- claude -p`, then `casen agent work`.

## API Reference

### `defineFlow(id, { name? })`

Starts a flow. Chain steps, then call `build()`. Every method returns a new builder.

| Method | BPMN | Adds to the variables |
|---|---|---|
| `.input<I>()` | — | `I` |
| `.run(id, handler, { name?, retries? })` | service task, job type `<flowId>.<id>` | what the handler returns |
| `.agent(id, { role, rank?, prompt, result? })` | service task, job type `agent:<role>` or `agent:<rank>:<role>` | `{ [result]: string }` (default `result`) |
| `.waitFor<P>(id, { correlationKey, message? })` | message catch event correlated on `=<correlationKey>` | `P` |
| `.approve<P>(id, { name?, assignee?, candidateGroups? })` | Camunda user task | `P` |
| `.loop(id, body, { until, max, between?, counter?, escalate? })` | counter script tasks + gateways; a user task after `max` rounds | what the body adds, and the counter (default `round`) |

### `Flow`

| Member | Description |
|---|---|
| `toXml()` / `definitions()` | The laid-out BPMN process |
| `jobTypes` | Job types of the `.run()` steps |
| `agentJobTypes` | Job types the workforce must serve |
| `steps` | The steps, in order |
| `runSteps` | Every `.run()` step, loop bodies included |
| `worker(options?)` | Polls the `.run()` job types; returns `{ done, stop() }`. Options: worker-client options, `maxJobs` (default 1), `timeout`, `onError`, `signal`, `client` |

### Agent contract

`agentJobType(role, rank?)`, `agentJobTypes(roles, rank?)`, `renderPrompt(template, variables)` and the header names `AGENT_PROMPT_HEADER` / `AGENT_RESULT_HEADER` are what `casen agent work` uses to serve `.agent()` steps — use them to write your own agent worker.

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
| [`@bpmnkit/operate`](https://www.npmjs.com/package/@bpmnkit/operate) | Monitoring & operations frontend for Camunda clusters |
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

[MIT](https://github.com/bpmnkit/bpmnkit/blob/main/LICENSE) © BPMN Kit — made by [u11g](https://u11g.com)

<div align="center">
  <a href="https://bpmnkit.com"><img src="https://bpmnkit.com/favicon.svg" width="32" height="32" alt="BPMN Kit"></a>
</div>
