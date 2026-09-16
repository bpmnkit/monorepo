# Script tasks — Defining a script task {#defining-a-task}

To define a script task with an inline FEEL expression, use the `zeebe:script` extension element. In the
`zeebe:script` extension element, perform the following steps:

1. Define the **FEEL expression** inside the `expression` attribute.
2. Define the name of process variable in the `resultVariable` attribute. This variable will store the result of the FEEL expression evaluation.

### Variable mappings

By default, the variable defined by `resultVariable` is merged into the process instance. This behavior can be
customized by defining an output mapping at the script task.

All variables in scope of the script task are available to the FEEL engine when the FEEL expression in the script task
is evaluated. Input mappings can be used to transform the variables into a format accepted by the FEEL expression.

**Info**
Input mappings are applied on activating the script task (or when an incident at the script task is resolved) before
the FEEL expression evaluation. When an incident is resolved at the script task, the input mappings are applied again
before evaluating the FEEL expression. This can affect the result of the FEEL expression evaluation.

For more information about this topic, visit the documentation about [input and output variable mappings](https://docs.camunda.io/docs/next/components/concepts/variables#inputoutput-variable-mappings).

---
Source: https://docs.camunda.io/docs/next/components/modeler/bpmn/script-tasks/script-tasks
