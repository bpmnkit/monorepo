# Global job statistics

`GET /jobs/statistics/global`

Returns global aggregated counts for jobs. Filter by the creation time window (required) and optionally by jobType.

- Required permissions: READ_JOB_METRIC on SYSTEM.
- Added in Camunda 8.9.
- Consistency: eventual.

Authentication: bearerAuth or basicAuth

Parameters:
  from (query, string, required)
  to (query, string, required)
  jobType (query, string)

Responses:
  200 GlobalJobStatisticsQueryResult — Global job metrics
  400 ProblemDetail — The provided data is not valid.
  401 ProblemDetail — The request lacks valid authentication credentials.
  403 ProblemDetail — Forbidden. The request is not allowed.
  500 ProblemDetail — An internal error occurred while processing the request.

---
Source: https://docs.camunda.io/docs/next/apis-tools/orchestration-cluster-api-rest/specifications/get-global-job-statistics.api
