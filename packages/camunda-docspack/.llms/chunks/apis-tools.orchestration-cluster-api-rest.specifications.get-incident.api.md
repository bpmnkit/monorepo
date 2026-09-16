# Get incident

`GET /incidents/{incidentKey}`

Returns incident as JSON.

- Required permissions: READ_PROCESS_INSTANCE on PROCESS_DEFINITION.
- Added in Camunda 8.6.
- Consistency: eventual.

Authentication: bearerAuth or basicAuth

Parameters:
  incidentKey (path, string, required)

Responses:
  200 IncidentResult — The incident is successfully returned.
  400 ProblemDetail — The provided data is not valid.
  401 ProblemDetail — The request lacks valid authentication credentials.
  403 ProblemDetail — Forbidden. The request is not allowed.
  404 ProblemDetail — The incident with the given key was not found.
  500 ProblemDetail — An internal error occurred while processing the request.

---
Source: https://docs.camunda.io/docs/next/apis-tools/orchestration-cluster-api-rest/specifications/get-incident.api
