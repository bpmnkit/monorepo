# Get process instance statistics by definition

`POST /incidents/statistics/process-instances-by-definition`

Returns statistics for active process instances with incidents, grouped by process
definition. The result set is scoped to a specific incident error hash code, which must be
provided as a filter in the request body.

- Required permissions: READ_PROCESS_INSTANCE on PROCESS_DEFINITION.
- Added in Camunda 8.9.
- Consistency: eventual.

Authentication: bearerAuth or basicAuth

Request body:
  application/json: IncidentProcessInstanceStatisticsByDefinitionQuery (required)
    filter (IncidentProcessInstanceStatisticsByDefinitionFilter, required) — Filter criteria for the aggregated process instance statistics.
    page (OffsetPagination) — Pagination parameters for the aggregated process instance statistics.
    sort (IncidentProcessInstanceStatisticsByDefinitionQuerySortRequest[]) — Sorting criteria for process instance statistics grouped by process definition.

Responses:
  200 IncidentProcessInstanceStatisticsByDefinitionQueryResult — The process instance incident statistics grouped by process definition are successfully returned.
  400 ProblemDetail — The provided data is not valid.
  401 ProblemDetail — The request lacks valid authentication credentials.
  403 ProblemDetail — Forbidden. The request is not allowed.
  500 ProblemDetail — An internal error occurred while processing the request.

---
Source: https://docs.camunda.io/docs/next/apis-tools/orchestration-cluster-api-rest/specifications/get-process-instance-statistics-by-definition.api
