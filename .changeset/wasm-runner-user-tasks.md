---
"@bpmnkit/engine": minor
---

`runScenarioWasm` (and so `casen test`) now runs scenarios that the TypeScript `runScenario` runs. It completes native user tasks with the `userTask` mock, and it delivers the message a waiting receive task expects, with the subscription's correlation key, as the simulator passes a receive task. A `userTask` mock with `error` is reported as an error, and the task stays open. Expected variables are compared structurally, so the key order of an object no longer matters. The `.bpmn.tests.json` format is unchanged.
