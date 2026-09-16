# Service tasks — Task definition

A service task must have a `taskDefinition`. The `taskDefinition` is used to specify which [job workers](https://docs.camunda.io/docs/next/components/concepts/job-workers) handle the service task work.

A `taskDefinition` specifies the following properties:

- `type` (required): Used as reference to specify which job workers request the respective service task job. For example, `order-items`.
  - `type` can be specified as any [static value](https://docs.camunda.io/docs/next/components/concepts/expressions#expressions-vs-static-values) (`myType`) or as a FEEL [expression](https://docs.camunda.io/docs/next/components/concepts/expressions) prefixed by `=` that evaluates to any FEEL string; for example, `= "order-" + priorityGroup`.
- `retries` (optional): Specifies the number of times the job is retried when a worker signals failure. The default is three.

The expressions are evaluated on activating the service task and must result in a `string` for the job type and a `number` for the retries.

Refer to an example in the form of the [XML representation](#xml-representation) below.

---
Source: https://docs.camunda.io/docs/next/components/modeler/bpmn/service-tasks/service-tasks
