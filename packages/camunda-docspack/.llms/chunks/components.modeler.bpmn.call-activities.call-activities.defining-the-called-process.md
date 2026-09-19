# Call activities — Defining the called process

A call activity must define the BPMN process ID of the called process as `processId`.

Usually, the `processId` is defined as a [static value](https://docs.camunda.io/docs/next/components/concepts/expressions#expressions-vs-static-values) (e.g. `shipping-process`), but it can also be defined as [expression](https://docs.camunda.io/docs/next/components/concepts/expressions) (e.g. `= "shipping-" + tenantId`). The expression is evaluated on activating the call activity and must result in a `string`.

The `bindingType` attribute determines which version of the called process is instantiated:

- `latest`: The latest deployed version at the moment the call activity is activated.
- `deployment`: The version that was deployed together with the currently running version of the calling process.
- `versionTag`: The latest deployed version that is annotated with the version tag specified in the `versionTag` attribute.

To learn more about choosing binding types, see [choosing the resource binding type](https://docs.camunda.io/docs/next/components/best-practices/modeling/choosing-the-resource-binding-type).

**Note**
If the `bindingType` attribute is not specified, `latest` is used as the default.

---
Source: https://docs.camunda.io/docs/next/components/modeler/bpmn/call-activities/call-activities
