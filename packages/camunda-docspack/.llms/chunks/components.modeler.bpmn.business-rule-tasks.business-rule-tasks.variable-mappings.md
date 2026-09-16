# Business rule tasks — Variable mappings

By default, the variable defined by `resultVariable` is merged into the process instance. This
behavior can be customized by defining an output mapping at the business rule task.

All variables in scope of the business rule task are available to the decision engine when the
decision is evaluated. Input mappings can be used to transform the variables into a format accepted
by the decision.

**Info**
Input mappings are applied on activating the business rule task (or when an incident at the business
rule task is resolved), before the decision evaluation. When an incident is resolved at the business
rule task, the input mappings are applied again before evaluating the decision. This can affect
the result of the decision.

For more information about this topic, visit the documentation about [input/output variable
mappings](https://docs.camunda.io/docs/next/components/concepts/variables#inputoutput-variable-mappings).

---
Source: https://docs.camunda.io/docs/next/components/modeler/bpmn/business-rule-tasks/business-rule-tasks
