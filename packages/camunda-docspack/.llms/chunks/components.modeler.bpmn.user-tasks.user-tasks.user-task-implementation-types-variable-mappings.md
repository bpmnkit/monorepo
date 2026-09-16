# User tasks — User task implementation types — Variable mappings

By default, all variables submitted when the user task is completed are merged into the process instance. To propagate only selected variables, define an output mapping on the user task. If one or more output mappings are defined, only the mapped variables are propagated.

Use input mappings to create [local variables](https://docs.camunda.io/docs/next/components/concepts/variables#local-variables) in the scope of the user task, for example to reshape process variables into the format a form expects. These local variables stay in the user task scope unless an output mapping propagates them.

For the mapping syntax, see [input/output variable mappings](https://docs.camunda.io/docs/next/components/concepts/variables#inputoutput-variable-mappings). For how a user task compares to other elements, see [variable propagation by BPMN element](https://docs.camunda.io/docs/next/components/concepts/variables#variable-propagation-by-bpmn-element).

---
Source: https://docs.camunda.io/docs/next/components/modeler/bpmn/user-tasks/user-tasks
