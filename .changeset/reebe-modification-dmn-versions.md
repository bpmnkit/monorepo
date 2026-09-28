---
"@bpmnkit/reebe-wasm": patch
---

Reebe closes its remaining known gaps with Zeebe's semantics.

- A `fromAi()` call that Zeebe rejects at deployment fails the deployment with Zeebe's message, `Failed to extract ad-hoc activity parameters for element '<id>'. …`. Before, the call or its argument was left out of `adHocSubProcessElements`.
- An ad-hoc `completionCondition` is evaluated in the ad-hoc sub-process's own scope, as in Zeebe, not in the activation's. When an event sub-process inside the ad-hoc sub-process completes, a result that is not a boolean raises an `EXTRACT_VALUE_ERROR` incident on the event sub-process, and resolving it evaluates the condition again. Before, it counted as false.
- Process instance modification: activate, terminate and move instructions, with ancestor selection, variable instructions and Zeebe's rejection messages, over REST (`POST /v2/process-instances/{key}/modification`, which answered 501) and gRPC `ModifyProcessInstance`.
- A redeployed DMN gets a new version when its content changes and keeps its version when it does not. A decision evaluates by its id (the latest version) or by its key: gRPC `EvaluateDecision` by `decisionKey` answered `UNIMPLEMENTED`. The REST evaluation is also served at the specification's path, `POST /v2/decision-definitions/evaluation`.
- A business rule task keeps its sequence flows and I/O mappings. The parser gave them to the sub-process around it.
- The embedded SQLite backend has the tables that DMN, element instances and variables need.
- gRPC `DeployProcess` and `DeployResource` deploy what they are sent. Before, the engine received no resources. They answer process, decision and decision requirements metadata. `EvaluateDecisionResponse` uses Zeebe's field numbers for the decision requirements id and key.

This is a patch for `@bpmnkit/reebe-wasm`: its JavaScript API does not change.
