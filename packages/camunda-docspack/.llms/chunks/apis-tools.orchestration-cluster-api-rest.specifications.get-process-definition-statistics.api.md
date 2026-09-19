# Get process definition statistics

`POST /process-definitions/{processDefinitionKey}/statistics/element-instances`

Get statistics about elements in currently running process instances by process definition key and search filter.

- Required permissions: READ_PROCESS_INSTANCE on PROCESS_DEFINITION.
- Added in Camunda 8.8.
- Consistency: eventual.

Authentication: bearerAuth or basicAuth

Parameters:
  processDefinitionKey (path, string, required)

Request body:
  application/json: ProcessDefinitionElementStatisticsQuery
    filter (ProcessDefinitionStatisticsFilter) — The process definition statistics search filters.

Responses:
  200 ProcessDefinitionElementStatisticsQueryResult — The process definition statistics result.
  400 ProblemDetail — The provided data is not valid.
  401 ProblemDetail — The request lacks valid authentication credentials.
  403 ProblemDetail — Forbidden. The request is not allowed.
  500 ProblemDetail — An internal error occurred while processing the request.

---
Source: https://docs.camunda.io/docs/next/apis-tools/orchestration-cluster-api-rest/specifications/get-process-definition-statistics.api
