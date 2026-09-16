# Get element instance statistics

`GET /process-instances/{processInstanceKey}/statistics/element-instances`

Get statistics about elements by the process instance key.

- Required permissions: READ_PROCESS_INSTANCE on PROCESS_DEFINITION.
- Added in Camunda 8.8.
- Consistency: eventual.

Authentication: bearerAuth or basicAuth

Parameters:
  processInstanceKey (path, string, required)

Responses:
  200 ProcessInstanceElementStatisticsQueryResult — The process instance statistics result.
  400 ProblemDetail — The provided data is not valid.
  401 ProblemDetail — The request lacks valid authentication credentials.
  403 ProblemDetail — Forbidden. The request is not allowed.
  500 ProblemDetail — An internal error occurred while processing the request.

---
Source: https://docs.camunda.io/docs/next/apis-tools/orchestration-cluster-api-rest/specifications/get-process-instance-statistics.api
