# Get job statistics by type

`POST /jobs/statistics/by-types`

Get statistics about jobs, grouped by job type.

- Required permissions: READ_JOB_METRIC on SYSTEM.
- Added in Camunda 8.9.
- Consistency: eventual.

Authentication: bearerAuth or basicAuth

Request body:
  application/json: JobTypeStatisticsQuery (required)
    filter (JobTypeStatisticsFilter)
    page (CursorForwardPagination) — Search cursor pagination.

Responses:
  200 JobTypeStatisticsQueryResult — The job type statistics result.
  400 ProblemDetail — The provided data is not valid.
  401 ProblemDetail — The request lacks valid authentication credentials.
  403 ProblemDetail — Forbidden. The request is not allowed.
  500 ProblemDetail — An internal error occurred while processing the request.

---
Source: https://docs.camunda.io/docs/next/apis-tools/orchestration-cluster-api-rest/specifications/get-job-type-statistics.api
