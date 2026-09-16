# Multi-instance — Defining the collection to iterate over

A multi-instance activity must have an `inputCollection` expression that defines the collection to iterate over (e.g. `= items`). Usually, it [accesses a variable](https://docs.camunda.io/docs/next/components/modeler/feel/language-guide/feel-variables#access-variable) of the process instance that holds the collection. The expression is evaluated on activating the multi-instance body. It must result in an `array` of any type (e.g. `["item-1", "item-2"]`).

**Tip**

If you need to iterate `n` times (like with a loop-cardinality), you can use the following expression with a [for-loop](https://docs.camunda.io/docs/next/components/modeler/feel/language-guide/feel-control-flow#for-loops): `for i in 1..n return i`.

To access the current element of the `inputCollection` value within the instance, the multi-instance activity can define the `inputElement` variable (e.g. `item`). The element is stored as a local variable of the instance under the given name.

If the `inputCollection` value is **empty**, the multi-instance body is completed immediately and no instances are created. It behaves like the activity is skipped.

---
Source: https://docs.camunda.io/docs/next/components/modeler/bpmn/multi-instance/multi-instance
