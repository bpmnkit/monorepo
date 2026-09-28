# Process Templates — Run the scenarios

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

---
Source: https://bpmnkit.com/docs/guides/templates
