# Get job statistics by worker

`POST /jobs/statistics/by-workers`

Get statistics about jobs, grouped by worker, for a given job type.

- Required permissions: READ_JOB_METRIC on SYSTEM.
- Added in Camunda 8.9.
- Consistency: eventual.

Authentication: bearerAuth or basicAuth

Request body:
  application/json: JobWorkerStatisticsQuery (required)
    filter (JobWorkerStatisticsFilter, required)
    page (CursorForwardPagination) — Search cursor pagination.

Responses:
  200 JobWorkerStatisticsQueryResult — The job worker statistics result.
  400 ProblemDetail — The provided data is not valid.
  401 ProblemDetail — The request lacks valid authentication credentials.
  403 ProblemDetail — Forbidden. The request is not allowed.
  500 ProblemDetail — An internal error occurred while processing the request.

---
Source: https://docs.camunda.io/docs/next/apis-tools/orchestration-cluster-api-rest/specifications/get-job-worker-statistics.api
