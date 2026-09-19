# Inclusive gateway — Conditions

A `conditionExpression` defines when a flow is taken. It is a [boolean expression](https://docs.camunda.io/docs/next/components/modeler/feel/language-guide/feel-boolean-expressions) that can access the process variables and compare them with literals or other variables. The condition is fulfilled when the expression returns `true`.

Multiple boolean values or comparisons can be combined as disjunction (`and`) or conjunction (`or`).

For example:

```feel
= totalPrice > 100

= order.customer = "Paul"

= orderCount > 15 or totalPrice > 50

= valid and orderCount > 0

= list contains(courses, "salad")
```

---
Source: https://docs.camunda.io/docs/next/components/modeler/bpmn/inclusive-gateways/inclusive-gateways
