---
"@bpmnkit/cli-sdk": patch
---

The `createWorkerCommand` doc example now returns a `WorkerJobResult` (`{ outcome: "complete", variables }`) from `processJob`. Before, it returned bare variables, which does not type-check against the SDK.
