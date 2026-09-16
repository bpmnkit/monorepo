# User task listeners — Limitations

User task listeners have the following limitations:

- **No variable handling**: User task listener jobs cannot be completed if variables are provided.
- **No BPMN error throwing**: Throwing BPMN errors from user task listener jobs is not supported.

### Legacy behavior before 8.10

User task listeners are designed for use with the [Orchestration Cluster API](https://docs.camunda.io/docs/next/apis-tools/orchestration-cluster-api-rest/orchestration-cluster-api-rest-overview).

Before Camunda 8.10, Tasklist V1 and the deprecated Tasklist API had the following limitations when used with user task listeners:

- **Tasklist v1 does not list tasks with pending task listeners**: If a task's lifecycle transition is blocked by a pending task listener, Tasklist v1 does not display the task in the task queue. However, Tasklist v1 can still show the details of such a task.
- **Tasklist v1 incorrectly lists creating tasks when filtering for the "all" status (open and completed)**: If a task's creation is blocked by a pending task listener, Tasklist v1 includes it in the task queue when filtering for the "all" status, even though the task has not yet been created.
- **Tasklist v1 API cannot filter for tasks with pending task listeners**: The deprecated Tasklist API cannot filter for the following task states when searching tasks: `CREATING`, `ASSIGNING`, `UPDATING`, `COMPLETING`, `CANCELING`. Tasks in these states are included in responses when not filtering by state.
- **Tasklist v1 API responses may not reflect corrections applied by task listeners**: Requests made to the deprecated Tasklist API can trigger a listener. Responses to such requests will appear as if the listener did not make any [corrections](#correcting-user-task-data) to the user task data, even when the listener did make corrections.

---
Source: https://docs.camunda.io/docs/next/components/concepts/user-task-listeners
