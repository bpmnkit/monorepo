# Execution listeners — Variables in an execution listener — `beforeAll` listeners

`beforeAll` listeners are supported only on the [multi-instance](https://docs.camunda.io/docs/next/components/modeler/bpmn/multi-instance/multi-instance) body. They are invoked once per multi-instance body activation, before the `inputCollection` is evaluated and inner instances are created.

When a multi-instance activity is entered, the engine processes the body and inner-activity listeners in the following order:

1. Variable input mappings of the multi-instance body are applied, if any.
2. All `beforeAll` body listeners are executed sequentially, in the order defined in the BPMN model.
3. The body's `inputCollection` expression is evaluated.
4. Inner instances are created, sequentially or in parallel, depending on the multi-instance configuration.
5. For each inner instance, the existing [Start listeners](#start-listeners) and [End listeners](#end-listeners) of the inner activity are invoked as usual.

You can use variables for the following use cases:

| Use case                         | Description                                                                                                                 |
| :------------------------------- | :-------------------------------------------------------------------------------------------------------------------------- |
| Dynamic collection               | Compute the `inputCollection` just before multi-instance evaluation, based on current process state or external data.       |
| Resolving identifiers into items | Resolve IDs into concrete items and write them into the collection variable that the multi-instance activity iterates over. |
| Pre-initializing shared context  | Set helper variables used by multi-instance expressions and the body's `completionCondition`.                               |

---
Source: https://docs.camunda.io/docs/next/components/concepts/execution-listeners
