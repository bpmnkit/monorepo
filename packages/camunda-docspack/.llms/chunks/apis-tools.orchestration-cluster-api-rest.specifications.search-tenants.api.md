# Search tenants

`POST /tenants/search`

Retrieves a filtered and sorted list of tenants.

- Required permissions: READ on TENANT.
- Added in Camunda 8.8.
- Consistency: eventual.

Authentication: bearerAuth or basicAuth

Request body:
  application/json: TenantSearchQueryRequest
    sort (TenantSearchQuerySortRequest[]) — Sort field criteria.
    filter (TenantFilter) — The tenant search filters.

Responses:
  200 TenantSearchQueryResult — The tenants search result
  400 ProblemDetail — The provided data is not valid.
  401 ProblemDetail — The request lacks valid authentication credentials.
  403 ProblemDetail — Forbidden. The request is not allowed.
  404 ProblemDetail — Not found
  500 ProblemDetail — An internal error occurred while processing the request.

---
Source: https://docs.camunda.io/docs/next/apis-tools/orchestration-cluster-api-rest/specifications/search-tenants.api
