# Call activities — Boundary events

![call-activity-boundary-event](assets/call-activities-boundary-events.png)

Interrupting and non-interrupting boundary events can be attached to a call activity.

When an interrupting boundary event is triggered, the call activity and the created process instance are terminated. The variables of the created process instance are not propagated to the call activity.

When a non-interrupting boundary event is triggered, the created process instance is not affected. The activities at the outgoing path have no access to the variables of the created process instance since they are bound to the other process instance.


## Variable mappings

Input mappings can be used to create new local variables in the scope of the call activity. These variables are also copied to the created process instance.

If the attribute `propagateAllChildVariables` is set (default: `true`), all variables of the created process instance are propagated to the call activity. This behavior can be customized by defining output mappings at the call activity. The output mappings are applied on completing the call activity and only those variables that are defined in the output mappings are propagated.

If you set `propagateAllChildVariables` to `false` and define no output mappings, the variables of the created process instance are discarded when the call activity completes. To return only selected variables to the caller, keep `propagateAllChildVariables` enabled and define output mappings.

It's recommended to define output mappings if the call activity is in a parallel flow (e.g. when it is marked as [parallel multi-instance](https://docs.camunda.io/docs/next/components/modeler/bpmn/multi-instance/multi-instance#variable-mappings)). Otherwise, variables can be accidentally overridden when they are changed in the parallel flow. Disable `propagateAllChildVariables` only if the caller does not need the child process variables at all.

By default, all variables of the call activity scope are copied to the created process instance. This can be limited to copying only the local variables of the call activity, by setting the attribute `propagateAllParentVariables` to `false`.

By disabling this attribute, variables existing at higher scopes are no longer copied. If the attribute `propagateAllParentVariables` is set (default: `true`), all variables are propagated to the child process instance.

For how a call activity compares to other elements, see [variable propagation by BPMN element](https://docs.camunda.io/docs/next/components/concepts/variables#variable-propagation-by-bpmn-element).

---
Source: https://docs.camunda.io/docs/next/components/modeler/bpmn/call-activities/call-activities
