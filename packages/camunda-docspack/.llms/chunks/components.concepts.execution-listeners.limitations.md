# Execution listeners — Limitations

Execution listeners have the following limitations:

- **Unsupported elements**: The following elements do not support `start` or `end` listeners due to their processing nature:
  - Start events (start ELs): Use `start` listeners of process instances or subprocesses to cover the missing `start` listeners for specific start events.
  - Boundary events (start ELs): Place the start logic in the `start` ELs of the main activity to which the boundary event is attached.
  - Gateways (end ELs): Use `start` ELs on the element following the gateway to execute the required logic. This allows handling of any post-execution tasks in a dedicated element.
  - Error end event (end ELs): Place the ELs on the related error catch event.
  - Compensation boundary events: Place the ELs on the compensation handler.

- **`beforeAll`**: Supported only for multi-instance activities.
  - Earlier versions do not support the `beforeAll` event type and will reject deployments that use it.

- **`cancel`**: Supported only on the process element.
  - Earlier versions do not support the `cancel` event type and will reject deployments that use it.

- **Duplicate listeners**: Execution listeners must have unique combinations of `eventType` and `type`.
  Defining multiple listeners with the same `eventType` and `type` results in a validation error. However, you can define listeners with the same `type` if they use different `eventType` values.

- **Interrupting escalation events**: For intermediate throw and end events with an interrupting escalation event, `end` listeners are not executed. The escalation event terminates the element's processing immediately upon activation, bypassing any defined `end` listeners.

- **Throwing a BPMN error**: This operation is not supported for execution listener jobs.

---
Source: https://docs.camunda.io/docs/next/components/concepts/execution-listeners
