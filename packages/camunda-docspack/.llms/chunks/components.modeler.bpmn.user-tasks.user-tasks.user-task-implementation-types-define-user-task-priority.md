# User tasks — User task implementation types — Define user task priority

You can use the `zeebe:priorityDefinition` extension element to specify the priority of a user task.

This allows you to prioritize the user task relative to other tasks within the same process, as well as across different processes.

To set the priority of a user task, specify the priority in the `priority` attribute.

- The priority must be an integer between `0` and `100`. If no value is provided, the default value is `50`.
- A higher priority value indicates higher importance.
- You can set the priority either as a static integer value or by using an [expression](https://docs.camunda.io/docs/next/components/concepts/expressions). Expressions are evaluated when the user task is activated and must result in an integer within the specified range.

---
Source: https://docs.camunda.io/docs/next/components/modeler/bpmn/user-tasks/user-tasks
