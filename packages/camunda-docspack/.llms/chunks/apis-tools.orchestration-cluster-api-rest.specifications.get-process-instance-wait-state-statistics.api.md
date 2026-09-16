# Get wait state statistics

`GET /process-instances/{processInstanceKey}/statistics/wait-states`

Get statistics about waiting element instances by the process instance key, grouped by element id.

- Required permissions: READ_PROCESS_INSTANCE on PROCESS_DEFINITION.
- Added in Camunda 8.10.
- Consistency: eventual.

Authentication: bearerAuth or basicAuth

Parameters:
  processInstanceKey (path, string, required)

Responses:
  200 ProcessInstanceWaitStateStatisticsQueryResult — The process instance wait state statistics result.
  400 ProblemDetail — The provided data is not valid.
  401 ProblemDetail — The request lacks valid authentication credentials.
  403 ProblemDetail — Forbidden. The request is not allowed.
  500 ProblemDetail — An internal error occurred while processing the request.

---
Source: https://docs.camunda.io/docs/next/apis-tools/orchestration-cluster-api-rest/specifications/get-process-instance-wait-state-statistics.api
