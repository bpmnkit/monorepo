# Get user task form

`GET /user-tasks/{userTaskKey}/form`

Get the form of a user task.
Note that this endpoint will only return linked forms. This endpoint does not support embedded forms.

- Added in Camunda 8.8.
- Consistency: eventual.

Authentication: bearerAuth or basicAuth

Parameters:
  userTaskKey (path, string, required)

Responses:
  200 FormResult — The form is successfully returned.
  204 — The user task was found, but no form is associated with it.
  400 ProblemDetail — The provided data is not valid.
  401 ProblemDetail — The request lacks valid authentication credentials.
  403 ProblemDetail — Forbidden. The request is not allowed.
  404 ProblemDetail — Not found
  500 ProblemDetail — An internal error occurred while processing the request.

---
Source: https://docs.camunda.io/docs/next/apis-tools/orchestration-cluster-api-rest/specifications/get-user-task-form.api
