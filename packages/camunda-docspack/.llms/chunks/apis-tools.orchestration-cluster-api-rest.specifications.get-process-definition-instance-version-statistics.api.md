# Get process instance statistics by version

`POST /process-definitions/statistics/process-instances-by-version`

Get statistics about process instances, grouped by version for a given process definition.
The process definition ID must be provided as a required field in the request body filter.

- Required permissions: READ_PROCESS_INSTANCE on PROCESS_DEFINITION.
- Added in Camunda 8.9.
- Consistency: eventual.

Authentication: bearerAuth or basicAuth

Request body:
  application/json: ProcessDefinitionInstanceVersionStatisticsQuery (required)
    page (OffsetPagination) — Pagination criteria.
    sort (ProcessDefinitionInstanceVersionStatisticsQuerySortRequest[]) — Sort field criteria.
    filter (ProcessDefinitionInstanceVersionStatisticsFilter, required) — The process definition instance version statistics search filters.

Responses:
  200 ProcessDefinitionInstanceVersionStatisticsQueryResult — The process definition instance version statistic result.
  400 ProblemDetail — The provided data is not valid.
  401 ProblemDetail — The request lacks valid authentication credentials.
  403 ProblemDetail — Forbidden. The request is not allowed.
  500 ProblemDetail — An internal error occurred while processing the request.

---
Source: https://docs.camunda.io/docs/next/apis-tools/orchestration-cluster-api-rest/specifications/get-process-definition-instance-version-statistics.api
