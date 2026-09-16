# Get error metrics for a job type

`POST /jobs/statistics/errors`

Returns aggregated metrics per error for the given jobType.

- Required permissions: READ_PROCESS_INSTANCE on PROCESS_DEFINITION.
- Added in Camunda 8.9.
- Consistency: eventual.

Authentication: bearerAuth or basicAuth

Request body:
  application/json: JobErrorStatisticsQuery (required)
    filter (JobErrorStatisticsFilter, required)
    page (CursorForwardPagination) — Search cursor pagination.

Responses:
  200 JobErrorStatisticsQueryResult — The job error statistics result.
  400 ProblemDetail — The provided data is not valid.
  401 ProblemDetail — The request lacks valid authentication credentials.
  403 ProblemDetail — Forbidden. The request is not allowed.
  500 ProblemDetail — An internal error occurred while processing the request.

---
Source: https://docs.camunda.io/docs/next/apis-tools/orchestration-cluster-api-rest/specifications/get-job-error-statistics.api
