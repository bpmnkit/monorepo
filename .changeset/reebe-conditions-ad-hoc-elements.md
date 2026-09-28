---
"@bpmnkit/reebe-wasm": patch
---

Reebe closes its last known gaps with Zeebe's gateway, ad-hoc sub-process and compensation behaviour.

- A condition on an exclusive or inclusive gateway's flow that does not evaluate to a boolean — `null` for a missing variable included — raises an `EXTRACT_VALUE_ERROR` incident instead of counting as false. Resolving it, after the variable is fixed, evaluates the gateway again. Conditions on the outgoing flows of any other element are ignored and every flow is taken, as Zeebe does.
- Every ad-hoc sub-process creates the `adHocSubProcessElements` variable: the elements it can activate, with their name, documentation, `zeebe:properties` and the parameters of the `fromAi()` calls in their input mappings, in the shape `@bpmnkit/engine` gives. `fromAi()` evaluates to its value, and FEEL calls to it may use named arguments.
- A complex gateway fails deployment with Zeebe's full message (`Elements of type 'ComplexGateway' are currently not supported. …`).
- Compensation handlers run in the throw event's scope and no longer start with a copy of the compensated activity's local variables, as in Zeebe. A throw event in an event sub-process also compensates the activities of the event sub-process. A handler that is terminated on its own counts as ended, so its throw event continues.
