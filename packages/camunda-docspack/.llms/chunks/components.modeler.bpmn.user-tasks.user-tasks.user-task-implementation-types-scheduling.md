# User tasks — User task implementation types — Scheduling

User tasks support specifying a task schedule using the `zeebe:taskSchedule` extension element.
You can use this to define when users interact with a given task. You can specify one or both of the following attributes simultaneously:

- `dueDate`: Specifies the due date of the user task.
- `followUpDate`: Specifies the follow-up date of the user task.

**Note**
For example, you can use the `followUpDate` to define the latest time a user should start working on a task, and then
use the `dueDate` to provide a deadline when the user task should be finished.

You can define the due date and follow-up date as static values (for example, `2023-02-28T13:13:10+02:00`) or [expressions](https://docs.camunda.io/docs/next/components/concepts/expressions) (for example, `= schedule.dueDate` and `= now() + duration("PT15S")`). The expressions are evaluated on activating the user task and must result in a `string` conforming to an ISO 8601 combined date and time representation.

**Info**

A specific point in time defined as ISO 8601 combined date and time representation. It must contain timezone information, either `Z` for UTC or a zone offset. Optionally, it can contain a zone id.

- `2019-10-01T12:00:00Z` - UTC time
- `2019-10-02T08:09:40+02:00` - UTC plus two hours zone offset
- `2019-10-02T08:09:40+02:00[Europe/Berlin]` - UTC plus two hours zone offset at Berlin

---
Source: https://docs.camunda.io/docs/next/components/modeler/bpmn/user-tasks/user-tasks
