# Get global user task listener

`GET /global-task-listeners/{id}`

Get a global user task listener by its id.

- Required permissions: READ_TASK_LISTENER on GLOBAL_LISTENER.
- Added in Camunda 8.9.
- Consistency: eventual.

Authentication: bearerAuth or basicAuth

Parameters:
  id (path, GlobalListenerId, required)

Responses:
  200 GlobalTaskListenerResult — The global user task listener is successfully returned.
  401 ProblemDetail — The request lacks valid authentication credentials.
  403 ProblemDetail — Forbidden. The request is not allowed.
  404 ProblemDetail — The global user task listener with the given id was not found.
  500 ProblemDetail — An internal error occurred while processing the request.

---
Source: https://docs.camunda.io/docs/next/apis-tools/orchestration-cluster-api-rest/specifications/get-global-task-listener.api
