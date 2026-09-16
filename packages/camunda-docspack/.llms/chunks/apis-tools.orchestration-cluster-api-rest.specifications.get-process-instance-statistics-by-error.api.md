# Get process instance statistics by error

`POST /incidents/statistics/process-instances-by-error`

Returns statistics for active process instances that currently have active incidents,
grouped by incident error hash code.

- Required permissions: READ_PROCESS_INSTANCE on PROCESS_DEFINITION.
- Added in Camunda 8.9.
- Consistency: eventual.

Authentication: bearerAuth or basicAuth

Request body:
  application/json: IncidentProcessInstanceStatisticsByErrorQuery
    page (OffsetPagination) — Pagination parameters for process instance statistics grouped by incident error.
    sort (IncidentProcessInstanceStatisticsByErrorQuerySortRequest[]) — Sorting criteria for process instance statistics grouped by incident error.

Responses:
  200 IncidentProcessInstanceStatisticsByErrorQueryResult — The statistics about process instances with incident, grouped by error hash code are successfully returned.
  400 ProblemDetail — The provided data is not valid.
  401 ProblemDetail — The request lacks valid authentication credentials.
  403 ProblemDetail — Forbidden. The request is not allowed.
  500 ProblemDetail — An internal error occurred while processing the request.

---
Source: https://docs.camunda.io/docs/next/apis-tools/orchestration-cluster-api-rest/specifications/get-process-instance-statistics-by-error.api
