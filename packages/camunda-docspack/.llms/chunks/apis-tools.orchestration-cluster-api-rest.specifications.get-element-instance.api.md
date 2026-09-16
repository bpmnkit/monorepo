# Get element instance

`GET /element-instances/{elementInstanceKey}`

Returns element instance as JSON.

- Required permissions: READ_PROCESS_INSTANCE on PROCESS_DEFINITION.
- Added in Camunda 8.8.
- Consistency: eventual.

Authentication: bearerAuth or basicAuth

Parameters:
  elementInstanceKey (path, string, required)

Responses:
  200 ElementInstanceResult — The element instance is successfully returned.
  400 ProblemDetail — The provided data is not valid.
  401 ProblemDetail — The request lacks valid authentication credentials.
  403 ProblemDetail — Forbidden. The request is not allowed.
  404 ProblemDetail — The element instance with the given key was not found. More details are provided in the response body.
  500 ProblemDetail — An internal error occurred while processing the request.

---
Source: https://docs.camunda.io/docs/next/apis-tools/orchestration-cluster-api-rest/specifications/get-element-instance.api
