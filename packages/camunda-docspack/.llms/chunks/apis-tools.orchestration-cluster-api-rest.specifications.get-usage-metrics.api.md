# Get usage metrics

`GET /system/usage-metrics`

Retrieve the usage metrics based on given criteria.

- Required permissions: READ_USAGE_METRIC on SYSTEM.
- Added in Camunda 8.8.
- Consistency: eventual.

Authentication: bearerAuth or basicAuth

Parameters:
  startTime (query, string, required)
  endTime (query, string, required)
  tenantId (query, TenantId)
  withTenants (query, boolean)

Responses:
  200 UsageMetricsResponse — The usage metrics search result.
  400 ProblemDetail — The provided data is not valid.
  401 ProblemDetail — The request lacks valid authentication credentials.
  403 ProblemDetail — Forbidden. The request is not allowed.
  500 ProblemDetail — An internal error occurred while processing the request.

---
Source: https://docs.camunda.io/docs/next/apis-tools/orchestration-cluster-api-rest/specifications/get-usage-metrics.api
