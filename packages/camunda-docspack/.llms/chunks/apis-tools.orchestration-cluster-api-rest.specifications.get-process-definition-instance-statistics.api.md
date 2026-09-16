# Get process instance statistics

`POST /process-definitions/statistics/process-instances`

Get statistics about process instances, grouped by process definition and tenant.

- Required permissions: READ_PROCESS_INSTANCE on PROCESS_DEFINITION.
- Added in Camunda 8.9.
- Consistency: eventual.

Authentication: bearerAuth or basicAuth

Request body:
  application/json: ProcessDefinitionInstanceStatisticsQuery
    page (OffsetPagination) — Search cursor pagination.
    sort (ProcessDefinitionInstanceStatisticsQuerySortRequest[]) — Sort field criteria.

Responses:
  200 ProcessDefinitionInstanceStatisticsQueryResult — The process definition instance statistic result.
  400 ProblemDetail — The provided data is not valid.
  401 ProblemDetail — The request lacks valid authentication credentials.
  403 ProblemDetail — Forbidden. The request is not allowed.
  500 ProblemDetail — An internal error occurred while processing the request.

---
Source: https://docs.camunda.io/docs/next/apis-tools/orchestration-cluster-api-rest/specifications/get-process-definition-instance-statistics.api
