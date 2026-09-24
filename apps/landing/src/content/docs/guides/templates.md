---
title: Process Templates
description: 25 runnable Camunda 8 process templates — business processes and AI agent patterns — with test scenarios, from the gallery, the editor or casen template use.
sidebar:
  order: 3
---

The [template gallery](/templates) holds 25 Camunda 8 processes you can start from. Each one
is built with the `@bpmnkit/core` builder and laid out automatically. Job types, IO mappings,
correlation keys, timers and error codes are already set. It lints with no errors, and it
comes with test scenarios: a happy path and at least one alternative path.

The templates live in `@bpmnkit/patterns/templates`. The package's tests build every
template, lint it, round-trip it through XML and run each scenario on `@bpmnkit/engine`.
A template that stops passing fails the build.

## What is in the gallery

| Category | Templates |
|---|---|
| Order to cash | `order-to-cash`, `payment-collection` |
| Approvals | `purchase-request-approval`, `expense-approval`, `contract-approval` |
| Onboarding | `employee-onboarding`, `customer-kyc-onboarding` |
| Incident & escalation | `incident-escalation`, `security-alert-triage` |
| Document processing | `invoice-capture`, `document-signature`, `document-classification` |
| SLA & timers | `support-ticket-sla`, `scheduled-report` |
| Sagas & error handling | `travel-booking-saga`, `payment-saga` |
| Human in the loop | `four-eyes-review`, `content-review` |
| AI agent patterns | `ai-prompt-chaining`, `ai-routing`, `ai-parallelization`, `ai-orchestrator-workers`, `ai-evaluator-optimizer`, `ai-human-approval-gate`, `ai-agent-tool-loop` |

The AI agent patterns follow Anthropic's
[Building effective agents](https://www.anthropic.com/engineering/building-effective-agents)
taxonomy. Each fixed step is one model call through Camunda's **AI Agent Task** connector
(`io.camunda.agenticai:aiagent:1`). The orchestrator–workers and tool-loop templates use the
**AI Agent Sub-process** connector (`io.camunda.agenticai:aiagent-job-worker:1`). That connector
is an ad-hoc sub-process whose tools are the activities inside it. The model decides which
tools to call and when.

## Use a template

Pick one of three ways from a template's page:

- **Open in editor** opens the diagram in the [browser editor](/editor). The link is
  `/editor?template=<id>`, and it only accepts a template id from the gallery.
- **Download .bpmn** saves the process model. The page also links the scenarios file and any
  DMN or form files.
- **`casen template use`** writes all the files into your project:

```sh
casen template list                          # all templates
casen template list --category ai-agents     # one category
casen template use purchase-request-approval processes/
```

```text
✓ Wrote processes/purchase-request-approval.bpmn
✓ Wrote processes/purchase-request-approval.bpmn.tests.json
✓ Wrote processes/approval-matrix.dmn
```

`casen template use` does not overwrite a file that already exists. Pass `--force` to
overwrite it. Then deploy each file with `casen deploy deploy <file> --target camunda8`, or
deploy them from the editor.

## Run the scenarios

The `.bpmn.tests.json` file has the scenario format that `runScenario` in
`@bpmnkit/engine` reads. Each scenario sets the start variables and the mocked job workers,
keyed by job type. Native user tasks are keyed `userTask`. The scenario also sets the element
path and the variables to expect. To run them in a Vitest or Node test:

```typescript
import { readFileSync } from "node:fs"
import { Bpmn, Dmn } from "@bpmnkit/core"
import { Engine, runScenario } from "@bpmnkit/engine"
import type { ProcessScenario } from "@bpmnkit/engine"

const defs = Bpmn.parse(readFileSync("processes/purchase-request-approval.bpmn", "utf8"))
const scenarios = JSON.parse(
  readFileSync("processes/purchase-request-approval.bpmn.tests.json", "utf8"),
) as ProcessScenario[]

for (const scenario of scenarios) {
  const engine = new Engine()
  // runScenario deploys the BPMN; deploy the decisions it calls yourself.
  engine.deploy({ decisions: Dmn.parse(readFileSync("processes/approval-matrix.dmn", "utf8")) })
  const result = await runScenario(engine, defs, scenario)
  console.log(result.passed ? "PASS" : "FAIL", scenario.name, result.failures)
}
```

What the scenarios can and cannot exercise follows from what the TypeScript engine runs (see
[Conformance](/docs/getting-started/conformance)):

- **Receive tasks** pass through in the simulator, so the scenario gives the message's
  variables as start inputs, for example `signatureStatus` in `document-signature`. On
  Camunda the receive task waits for the message with the correlation key set in the model.
- **Timer boundary events**, such as the SLA and reminder timers, are in every model. No
  scenario takes a timer path, because a scenario completes each task at once, before a
  timer can fire.
- **The AI Agent Sub-process** runs as one job in the simulator. The scenario mocks that job
  type and returns the agent's final `agent` result. The simulator does not run the tools
  inside the sub-process.
- **The inclusive split** in `employee-onboarding` ends each branch at its own end event.
  The simulator does not synchronise an inclusive join.

`casen test` runs the same scenarios on the Reebe WebAssembly engine, which has Zeebe's
semantics. Every gallery scenario passes on both engines, and the package tests check both.
Reebe runs the scenario in the same way as the simulator:

- A native user task is completed with the outputs of the `userTask` mock.
- A receive task gets its message at once, with the correlation key from the model and no
  variables. The scenario gives the message's variables as start inputs.
- An AI Agent Sub-process runs as one job. Completing the job completes the sub-process.
  The tools inside it are not run.
- An error end event throws its error code. The error boundary on the enclosing
  sub-process catches it, or an incident is raised.

## AI templates: model and secrets

Every AI step sends its API key as `{{secrets.ANTHROPIC_API_KEY}}`. Add that connector secret
to your cluster before you deploy. The model is set in one place in the package
(`TEMPLATE_MODEL`). In a template you copied, change the `provider.anthropic.model.model`
input.

The AI Agent Sub-process templates also set an `errorExpression` header. It turns a connector
failure, such as reaching the model-call limit, into the BPMN error `AGENT_FAILED`. An error
boundary on the sub-process catches it, so a failure goes to a fallback path and does not
become an incident.

## From code

```typescript
import {
  ALL_TEMPLATES,
  TEMPLATE_CATEGORIES,
  getTemplate,
  listJobTypes,
  templateFiles,
} from "@bpmnkit/patterns/templates"

const template = getTemplate("ai-evaluator-optimizer")
const defs = template?.build()                  // BpmnDefinitions, laid out
const files = template ? templateFiles(template) : [] // [{ path, content }] — what casen writes
const workers = defs ? listJobTypes(defs) : []  // job types your workers must serve
```

`build()` returns a new model on each call, so you can change it with `Bpmn.continueProcess` or
the builder before you export it.

## Add a template

Templates are TypeScript files in `packages/patterns/src/templates/`, one file per category.
Add a `ProcessTemplate` object to the file, then add it to `ALL_TEMPLATES` in `index.ts`. The
gallery test checks it with no other change: it must build, lint with no errors, round-trip,
and pass every scenario. The gallery page, the `casen template` commands and `llms.txt` all
read the same list.
