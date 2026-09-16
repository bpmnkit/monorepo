# Process instance creation — FEEL context variables — Propagation to child instances

When a process instance with a business ID creates a child process instance via a [call activity](https://docs.camunda.io/docs/next/components/modeler/bpmn/call-activities/call-activities), the business ID is automatically propagated to the child by default.

Each child instance inherits the same business ID as its parent, letting you trace an entire process hierarchy using a single domain identifier.

Starting in 8.10, a call activity can override the inherited business ID by setting a literal value or [FEEL expression](https://docs.camunda.io/docs/next/components/concepts/expressions) on the call activity. The value is resolved once at child creation and is then immutable. See [business ID propagation](https://docs.camunda.io/docs/next/components/modeler/bpmn/call-activities/call-activities#business-id-propagation) for configuration details.

---
Source: https://docs.camunda.io/docs/next/components/concepts/process-instance-creation
