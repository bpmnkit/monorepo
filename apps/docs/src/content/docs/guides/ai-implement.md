---
title: Building Processes with AI
description: Go from a natural language description to a deployed, tested BPMN process — via a deterministic ProcessPlan pipeline, never hand-written XML.
---

BPMNKit's AI pipeline never asks an LLM to write BPMN XML. Every process is authored as a
`ProcessPlan` JSON file and compiled deterministically by `casen synth` — this is what makes
generated processes reliably valid, deployable, and easy to diff. The LLM's job is narrower and
more reliable: write the plan, resolve connectors, and fix reported problems.

## The pipeline

```
"implement X" (natural language)
        │
        ▼
  ProcessPlan JSON  ──casen synth──▶  laid-out, deployable .bpmn
        │                                    │
        │                            casen lint --profile deploy
        │                                    │
        └──casen plan extract◀────────  casen test
                (for later edits)
```

1. **Check for a reusable domain pattern** — `casen pattern list`/`get` (see [Pattern Library](/guides/patterns/)) surfaces domain context (regulations, conventions) and realistic worker specs, used as reference while writing the plan below — not pasted in as a `ProcessPlan` directly.
2. **Resolve external interactions** — `casen connector search "<system>"` / `casen connector show <template-id>` find the right Camunda connector template and its required inputs, instead of guessing property keys.
3. **Write the plan** — a `ProcessPlan` JSON file (`casen plan schema` prints the full format reference).
4. **Compile** — `casen synth <plan>.json --output <file>.bpmn`. Problems are reported keyed by JSON path (e.g. `steps[2].connector.values.token`) — fix the plan, never the XML, and re-run.
5. **Test** — a `tests` array in the plan compiles to a `<file>.bpmn.tests.json` sidecar automatically; run it with `casen test <file>.bpmn`.
6. **Deploy-readiness gate** — `casen lint <file>.bpmn --profile deploy` must report zero errors before deploying.
7. **Deploy** — `casen deploy deploy <file>.bpmn` (local Reebe) or `--target camunda8`.

## The Claude Code plugin

The richest way to drive this pipeline is the `bpmnkit` Claude Code plugin:

```sh
/plugin marketplace add github:bpmnkit/monorepo
/plugin install bpmnkit
```

It's **CLI-first**: every skill drives `casen` via Bash — no MCP server, no proxy daemon. Each skill reads the relevant generated/hand-written reference doc (plan format, connector catalog, agentic pattern, FEEL syntax, modeling conventions) before authoring a plan.

```
/bpmnkit:implement an invoice approval process for accounts payable
```

Claude works through: resolve connectors → write the plan → compile → test → scaffold missing workers → present a summary → ask where to deploy.

Related skills: `/bpmnkit:extend <file> <change>` (lift an existing process to a plan, apply a targeted delta, merge), `/bpmnkit:agent` (design an AI Agent Sub-process — see [AI Agents](/guides/ai-agents/)), `/bpmnkit:connect <file> <step> <service>` (wire an existing step to a connector), `/bpmnkit:review`, `/bpmnkit:test`, `/bpmnkit:deploy`.

## Lightweight alternative: `casen skills install`

If you don't want the full plugin, four minimal slash commands are available directly from the CLI — see [AIKit Skills](/cli/skills/):

```sh
casen skills install
```

This installs `/implement`, `/review`, `/test`, `/deploy` into `.claude/commands/`. Same underlying pipeline, less scaffolding around it (no `/extend`/`/agent`/`/connect`, no generated reference docs).

## What gets created

```
project/
  invoice-approval.plan.json         ← the source of truth — edit this, not the XML
  invoice-approval.bpmn              ← compiled by casen synth
  invoice-approval.bpmn.tests.json   ← scenarios, if the plan had a `tests` array
  workers/
    validate-invoice/
      index.ts                       ← implement the job logic here
      package.json
      tsconfig.json
      README.md
```

## Deploying

```
Deploy to local Reebe, deploy to Camunda 8, or skip?
```

- **Local Reebe** — deploys via `ZEEBE_ADDRESS` (default `http://localhost:26500`). Start Reebe first: `casen reebe start --port 26500`.
- **Camunda 8** — deploys using the active `casen` profile. Set one up with `casen profile create`.
- **Skip** — leaves the plan and BPMN file on disk for manual review and deployment.

## Implementing workers

Each scaffolded worker uses `@bpmnkit/worker-client`'s real polling API:

```typescript
// workers/validate-invoice/index.ts
import { createWorkerClient } from "@bpmnkit/worker-client"

const client = createWorkerClient({ workerName: "validate-invoice-worker" })

for await (const job of client.poll("validate-invoice:1")) {
  try {
    // TODO: implement invoice validation
    await job.complete({ /* output variables */ })
  } catch (err) {
    await job.fail(String(err))
  }
}
```

Start a worker for development:

```sh
cd workers/validate-invoice
npm install
npm start
```

Or start all workers at once:

```sh
casen worker start
```

See [Standalone Workers](/guides/workers-standalone/) for deployment options.

## Extending an existing process

```
/bpmnkit:extend invoice-approval.bpmn add a timeout boundary event to the approval task
```

This lifts the process back into plan form (`casen plan extract`), writes a small delta plan touching only the changed step, and merges it in (`casen synth --merge`) — the diff is reported at the element level, not as an XML diff.
