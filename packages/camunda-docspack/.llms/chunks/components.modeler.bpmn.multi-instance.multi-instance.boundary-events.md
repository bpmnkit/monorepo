# Multi-instance — Boundary events

![multi-instance with boundary event](assets/multi-instance-boundary-event.png)

Interrupting and non-interrupting boundary events can be attached to a multi-instance activity.

When an interrupting boundary event is triggered, the multi-instance body and all active instances are terminated. The `outputCollection` variable is not propagated to the parent scope (i.e. no partial output).

When a non-interrupting boundary event is triggered, the instances are not affected. The activities at the outgoing path have no access to the local variables since they are bound to the multi-instance activity.


## Special multi-instance variables

Every instance has a local variable `loopCounter`. It holds the index in the `inputCollection` of this instance, starting with `1`.

---
Source: https://docs.camunda.io/docs/next/components/modeler/bpmn/multi-instance/multi-instance
