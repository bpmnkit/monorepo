---
"@bpmnkit/reebe-wasm": patch
---

Reebe matches Zeebe on six more points.

- `adHocSubProcessElements` has Zeebe's shape. A `fromAi()` parameter is named by its whole reference (`toolCall.orderId`), a call on any reference is listed, and a field that is null or empty is left out. An empty property value is `null`. It is the same shape `@bpmnkit/engine` gives.
- A compensation handler that is terminated on its own no longer releases its throw event. As in Zeebe, the throw event continues only when its handlers complete.
- A multi-instance or ad-hoc `completionCondition` that does not evaluate to a boolean raises an `EXTRACT_VALUE_ERROR` incident with Zeebe's message instead of counting as false. Resolving the incident evaluates the condition again.
- A flow element written as an empty tag (`<bpmn:userTask id="x"/>`) is parsed like one with children. Undefined tasks (`bpmn:task`) and manual tasks pass through.
- The gRPC calls pass their `variables` documents on as variables. They reject a document that is not a JSON object with `INVALID_ARGUMENT`, as Zeebe's gateway does. `CreateProcessInstance` reaches the engine's instance creation, `FailJob` variables become local variables of the job's task, and `EvaluateDecision` evaluates the decision. DMN decisions are stored on PostgreSQL.
- The `CONDITION_ERROR` message of an exclusive or inclusive gateway is Zeebe's: `Expected at least one condition to evaluate to true, or to have a default flow`.
