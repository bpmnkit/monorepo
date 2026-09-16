# Receive tasks — Messages

A message can be referenced by one or more receive tasks; it must define the name of the message (e.g. `Money collected`) and the `correlationKey` expression (e.g. `= orderId`).

Usually, the name of the message is defined as a [static value](https://docs.camunda.io/docs/next/components/concepts/expressions#expressions-vs-static-values) (e.g. `order canceled`), but it can also be defined as [expression](https://docs.camunda.io/docs/next/components/concepts/expressions) (e.g. `= "order " + awaitingAction`). The expression is evaluated on activating the receive task and must result in a `string`.

The `correlationKey` is an expression that usually [accesses a variable](https://docs.camunda.io/docs/next/components/modeler/feel/language-guide/feel-variables#access-variable) of the process instance that holds the correlation key of the message. The expression is evaluated on activating the receive task and must result either in a `string` or `number`.

To correlate a message to the receive task, the message is published with the defined name (e.g. `Money collected`) and the value of the `correlationKey` expression. For example, if the process instance has a variable `orderId` with value `"order-123"`, the message is published with the correlation key `"order-123"`.

---
Source: https://docs.camunda.io/docs/next/components/modeler/bpmn/receive-tasks/receive-tasks
