# Conditionals — Conditional event triggers — On variable changes (2)

#### Variable filter semantics

Conditional events can define variable filters to limit when the engine re-evaluates the condition.
By default, the engine derives the set of variables that can trigger an event from the FEEL expression.
The subscription is re-evaluated only when one of those referenced variables changes within the event’s visible scope.
See how filters can be defined in the [conditional events modeling guide](https://docs.camunda.io/docs/next/components/modeler/bpmn/conditional-events/conditional-events#variable-filters).

Variable filters restrict evaluation based on specific variable change types (for example, `create` or `update`).

Variable change type filters apply only to conditional events within a running process instance. They do not apply to root-level conditional start events, because no process instance exists yet.

#### Considerations

Conditional events enable reactive process behavior, but incorrect modeling can lead to unintended triggers. Keep the following behavior in mind.

##### Single evaluation per state update

If a single command (for example, an update variables request or job completion) updates multiple variables and more than one satisfies the condition, the subscription triggers only once.

Using the process definition shown earlier (a service task with an interrupting conditional boundary event), assume the boundary condition is `x > 10 or y > 5`.

If both variables `x` and `y` are updated in a single request (for example, via the [update element instance variables API](https://docs.camunda.io/docs/next/apis-tools/orchestration-cluster-api-rest/specifications/create-element-instance-variables.api)) and both satisfy the condition, the boundary event triggers only once.

##### Input mappings behavior

If an activity defines an input mapping that sets a variable satisfying the boundary condition, the conditional boundary event can trigger when the activity is activated.

##### Output mappings behavior

If an activity defines an output mapping that sets a variable satisfying the boundary condition, the conditional boundary event does not trigger when the activity completes.

The engine removes the boundary subscription when the activity completes. Variables written during completion are applied after the subscription is removed.

Using the same process definition shown earlier (a service task with an interrupting conditional boundary event), if service task A completes and sets variable `x` to `11`, the boundary event with condition `x > 10` does not trigger because the subscription has already been removed.

##### Multi-instance behavior

The behavior of conditional boundary events depends on where the variable is updated.

- With an interrupting conditional boundary event on the multi-instance body, a child instance that updates a variable and satisfies the condition can interrupt the entire multi-instance activity.
- With a non-interrupting conditional boundary event on the multi-instance body, each child instance that satisfies the condition triggers its own boundary event without interrupting the multi-instance body.
- A local-scope variable update on a multi-instance child triggers the boundary event only for that child instance. Other child instances continue unaffected.
- A process-scope variable update that is visible to all multi-instance children triggers boundary events on all active child instances whose conditions evaluate to `true`.

---
Source: https://docs.camunda.io/docs/next/components/concepts/conditionals
