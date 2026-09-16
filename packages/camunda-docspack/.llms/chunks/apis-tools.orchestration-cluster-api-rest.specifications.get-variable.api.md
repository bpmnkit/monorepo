# Get variable

`GET /variables/{variableKey}`

Get a variable by its key.

This endpoint returns both process-level and local (element-scoped) variables.
The variable's scopeKey indicates whether it's a process-level variable or scoped to a
specific element instance.

- Required permissions: READ_PROCESS_INSTANCE on PROCESS_DEFINITION.
- Added in Camunda 8.8.
- Consistency: eventual.

Authentication: bearerAuth or basicAuth

Parameters:
  variableKey (path, string, required)

Responses:
  200 VariableResult — The variable is successfully returned.
  400 ProblemDetail — The provided data is not valid.
  401 ProblemDetail — The request lacks valid authentication credentials.
  403 ProblemDetail — Forbidden. The request is not allowed.
  404 ProblemDetail — Not found
  500 ProblemDetail — An internal error occurred while processing the request.

---
Source: https://docs.camunda.io/docs/next/apis-tools/orchestration-cluster-api-rest/specifications/get-variable.api
