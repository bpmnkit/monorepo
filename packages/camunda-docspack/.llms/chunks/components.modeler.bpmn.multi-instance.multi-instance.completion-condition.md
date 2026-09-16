# Multi-instance — Completion condition

A `completionCondition` defines whether the multi-instance body can be completed immediately when the condition is satisfied. It is a [boolean expression](https://docs.camunda.io/docs/next/components/modeler/feel/language-guide/feel-boolean-expressions) that will be evaluated each time the instance of the multi-instance body completes. Any instances that are still active are terminated and the multi-instance body is completed when the expression evaluates to `true`.

The BPMN 2.0 specification defines the following properties of a multi-instance body:

- `numberOfInstances`: The number of instances created.
- `numberOfActiveInstances`: The number of instances currently active.
- `numberOfCompletedInstances`: The number of instances already completed.
- `numberOfTerminatedInstances`: The number of instances already terminated.

These properties are available for use in the `completionCondition` expression. For example, using these properties you can express "complete the multi-instance body when 50% or more of the instances already completed" as `= numberOfCompletedInstances / numberOfInstances >= 0.5`. Although these properties are available in this expression, they do not exist as process variables. These properties take precedence over process variables with the same name.

Multiple boolean values or comparisons can be combined as disjunction (`and`) or conjunction (`or`).

For example:

```feel
= result.isSuccessful

= count(["a", "b", "c", "d"]) > 3

= orderCount >= 5 and orderCount < 15

= list contains([6,7], today().weekday)

= numberOfCompletedInstances = 2

= numberOfCompletedInstances / numberOfInstances >= 0.5
```

---
Source: https://docs.camunda.io/docs/next/components/modeler/bpmn/multi-instance/multi-instance
