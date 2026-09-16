# User tasks — User task implementation types — User task listeners

User tasks support **user task listeners**, which allow you to react to user task lifecycle events.

To define a user task listener, include the `zeebe:taskListeners` extension element within the user task in your BPMN model. This element can contain one or more `zeebe:taskListener` elements, each specifying the following attributes:

- The `eventType` (required) that triggers the listener. Possible values are: `creating`, `assigning`, `updating`, `completing`, `canceling`.
- The `type` (required) of the listener. Used as a reference to specify which job workers request the respective task listener job. For example, `order-items`. `type` can be specified as any static value (`myType`) or as a FEEL expression prefixed by `=` that evaluates to any FEEL string; for example, `= "order-" + priorityGroup`.
- The number of `retries` (optional) for the user task listener job (defaults to 3 if omitted).

For more details, see [user task listeners](https://docs.camunda.io/docs/next/components/modeler/bpmn/user-tasks/components/concepts/user-task-listeners).

---
Source: https://docs.camunda.io/docs/next/components/modeler/bpmn/user-tasks/user-tasks
