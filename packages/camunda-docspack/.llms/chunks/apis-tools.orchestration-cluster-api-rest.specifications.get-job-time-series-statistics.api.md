# Get time-series metrics for a job type

`POST /jobs/statistics/time-series`

Returns a list of time-bucketed metrics ordered ascending by time.
The `from` and `to` fields select the time window of interest.
Each item in the response corresponds to one time bucket of the requested resolution.

- Required permissions: READ_JOB_METRIC on SYSTEM.
- Added in Camunda 8.9.
- Consistency: eventual.

Authentication: bearerAuth or basicAuth

Request body:
  application/json: JobTimeSeriesStatisticsQuery (required)
    filter (JobTimeSeriesStatisticsFilter, required)
    page (CursorForwardPagination) — Search cursor pagination.

Responses:
  200 JobTimeSeriesStatisticsQueryResult — The job time-series statistics result.
  400 ProblemDetail — The provided data is not valid.
  401 ProblemDetail — The request lacks valid authentication credentials.
  403 ProblemDetail — Forbidden. The request is not allowed.
  500 ProblemDetail — An internal error occurred while processing the request.

---
Source: https://docs.camunda.io/docs/next/apis-tools/orchestration-cluster-api-rest/specifications/get-job-time-series-statistics.api
