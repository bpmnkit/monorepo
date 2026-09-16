# Create global user task listener

`POST /global-task-listeners`

Create a new global user task listener.

- Required permissions: CREATE_TASK_LISTENER on GLOBAL_LISTENER.
- Added in Camunda 8.9.
- Consistency: strong.

Authentication: bearerAuth or basicAuth

Request body:
  application/json: CreateGlobalTaskListenerRequest (required)
    id (GlobalListenerId, required)

Responses:
  201 GlobalTaskListenerResult — The global user task listener was created successfully.
  400 ProblemDetail — The provided data is not valid.
  401 ProblemDetail — The request lacks valid authentication credentials.
  403 ProblemDetail — Forbidden. The request is not allowed.
  409 ProblemDetail — A global listener with this id already exists.
  500 ProblemDetail — An internal error occurred while processing the request.
  503 ProblemDetail — The service is currently unavailable. This may happen only on some requests where the system creates backpressure to prevent the server's compute resources from being exhausted, avoiding more severe failures. In this case, the title of the error object contains `RESOURCE_EXHAUSTED`. Clients are recommended to eventually retry those requests after a backoff period. You can learn more about the backpressure mechanism here: https://docs.camunda.io/docs/components/zeebe/technical-concepts/internal-processing/#handling-backpressure .

---
Source: https://docs.camunda.io/docs/next/apis-tools/orchestration-cluster-api-rest/specifications/create-global-task-listener.api
