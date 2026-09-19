# Business rule tasks — Defining a called decision {#defining-a-task}

A called decision links the business rule task to a DMN decision, either to
a [decision table](https://docs.camunda.io/docs/next/components/modeler/dmn/decision-table) or to
a [decision literal expression](https://docs.camunda.io/docs/next/components/modeler/dmn/decision-literal-expression)
. It can be defined using the
`zeebe:calledDecision` extension element.

A business rule task must define the [DMN decision id](https://docs.camunda.io/docs/next/components/modeler/dmn/decision-table#decision-id) of the
called decision as `decisionId`. Usually, the `decisionId` is defined as a [static value](https://docs.camunda.io/docs/next/components/concepts/expressions#expressions-vs-static-values) (for example, `shipping_box_size`), but
it can also be defined as an [expression](https://docs.camunda.io/docs/next/components/concepts/expressions) (
for example, `= "shipping_box_size_" + countryCode`). The expression is evaluated on activating the business rule task (or when
an incident at the business rule task is resolved) after input mappings have been applied. The expression must result in
a `string`.

The `bindingType` attribute determines which version of the called decision is evaluated:

- `latest`: The latest deployed version at the moment the business rule task is activated.
- `deployment`: The version that was deployed together with the currently running version of the process.
- `versionTag`: The latest deployed version that is annotated with the version tag specified in the `versionTag` attribute. Usually, the `versionTag` is defined as a [static value](https://docs.camunda.io/docs/next/components/concepts/expressions#expressions-vs-static-values) (for example, `v1.0`), but it can also be defined as an [expression](https://docs.camunda.io/docs/next/components/concepts/expressions) (for example, `= "v" + version`). The expression is evaluated on activating the business rule task or when an incident at the business rule task is resolved, after input mappings have been applied. The expression must result in a `string`.

To learn more about choosing binding types, see [choosing the resource binding type](https://docs.camunda.io/docs/next/components/best-practices/modeling/choosing-the-resource-binding-type).

**Note**
If the `bindingType` attribute is not specified, `latest` is used as the default.

A business rule task must define the process variable name of the decision result as
`resultVariable`. The result of the decision is stored in this variable. The `resultVariable`
is defined as a static value.

---
Source: https://docs.camunda.io/docs/next/components/modeler/bpmn/business-rule-tasks/business-rule-tasks
