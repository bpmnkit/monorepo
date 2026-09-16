# Search roles

`POST /roles/search`

Search for roles based on given criteria.

- Required permissions: READ on ROLE.
- Added in Camunda 8.8.
- Consistency: eventual.

Authentication: bearerAuth or basicAuth

Request body:
  application/json: RoleSearchQueryRequest
    sort (RoleSearchQuerySortRequest[]) — Sort field criteria.
    filter (RoleFilter) — The role search filters.

Responses:
  200 RoleSearchQueryResult — The roles search result.
  400 ProblemDetail — The provided data is not valid.
  401 ProblemDetail — The request lacks valid authentication credentials.
  403 ProblemDetail — Forbidden. The request is not allowed.
  500 ProblemDetail — An internal error occurred while processing the request.

---
Source: https://docs.camunda.io/docs/next/apis-tools/orchestration-cluster-api-rest/specifications/search-roles.api
