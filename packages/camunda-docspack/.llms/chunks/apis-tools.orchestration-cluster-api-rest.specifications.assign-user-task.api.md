# Assign user task

`POST /user-tasks/{userTaskKey}/assignment`

Assigns a user task with the given key to the given assignee. Assignment waits for blocking task listeners on this lifecycle transition. If listener processing is delayed beyond the request timeout, this endpoint can return 504. Other gateway timeout causes are also possible. Retry with backoff and inspect listener worker availability and logs when this repeats.

- Added in Camunda 8.5.
- Consistency: strong.

Authentication: bearerAuth or basicAuth

Parameters:
  userTaskKey (path, string, required)

Request body:
  application/json: UserTaskAssignmentRequest (required)
    assignee (string) — The assignee for the user task. The assignee must not be empty or `null`.
    allowOverride (boolean) — By default, the task is reassigned if it was already assigned. Set this to `false` to return an error in such cases. The task must then first be unassigned to…
    action (string) — A custom action value that will be accessible from user task events resulting from this endpoint invocation. If not provided, it will default to "assign".

Responses:
  204 — The user task's assignment was adjusted.
  400 ProblemDetail — The provided data is not valid.
  404 ProblemDetail — The user task with the given key was not found.
  409 ProblemDetail — The user task with the given key is in the wrong state currently. More details are provided in the response body.
  500 ProblemDetail — An internal error occurred while processing the request.
  503 ProblemDetail — The service is currently unavailable. This may happen only on some requests where the system creates backpressure to prevent the server's compute resources from being exhausted, avoiding more severe failures. In this case, the title of the error object contains `RESOURCE_EXHAUSTED`. Clients are recommended to eventually retry those requests after a backoff period. You can learn more about the backpressure mechanism here: https://docs.camunda.io/docs/components/zeebe/technical-concepts/internal-processing/#handling-backpressure .
  504 ProblemDetail — The request timed out between the gateway and the broker. For these endpoints, this often happens when user task listeners are configured and the corresponding listener job is not completed within the request timeout. Common causes include no available job workers for the listener type, busy or crashed job workers, or delayed job completion. As with any gateway timeout, general timeout causes (for example transient network issues) can also result in a 504 response. Troubleshooting: - verify that job workers for the listener type are running and healthy - check worker logs for crashes, retries, and completion failures - check network connectivity between workers, gateway, and broker - retry with backoff after transient failures - fail without retries if a problem persists

---
Source: https://docs.camunda.io/docs/next/apis-tools/orchestration-cluster-api-rest/specifications/assign-user-task.api
