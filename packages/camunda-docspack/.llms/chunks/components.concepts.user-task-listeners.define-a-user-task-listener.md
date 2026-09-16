# User task listeners — Define a user task listener

You can configure user task listeners either:

- Per BPMN user task element.
- For all user tasks in the cluster. See [Global user task listeners](https://docs.camunda.io/docs/next/components/concepts/global-user-task-listeners).

### User task listener properties

Each user task listener has the following properties:

| Property    | Description                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| :---------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `eventType` | (Required) Specifies the user task event type that triggers the listener. Supported values are `creating`, `assigning`, `updating`, `completing`, and `canceling`.                                                                                                                                                                                                                                                                                                                                            |
| `type`      | (Required) The name of the job type, used as a reference to specify which job workers request the respective task listener job. For example, `order-items`. The `type` can be specified as any static value (`myType`), or as a FEEL expression prefixed with `=`, that evaluates to a FEEL string; for example, `= "order-" + priorityGroup`. This is a case-sensitive field, if supported by the underlying operating system. For example, `orderProcess` refers to a different worker than `OrderProcess`. |
| `retries`   | (Optional) The number of retries for the user task listener job (defaults to 3 if omitted).                                                                                                                                                                                                                                                                                                                                                                                                                   |

**Note**
If multiple user task listeners of the same `eventType` (such as multiple `assigning` listeners) are defined on the same user task, they are executed sequentially, one after the other, in the order they are defined in the BPMN model.

---
Source: https://docs.camunda.io/docs/next/components/concepts/user-task-listeners
