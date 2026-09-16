# Search role groups

`POST /roles/{roleId}/groups/search`

Search groups with assigned role.

- Required permissions: READ on ROLE.
- Added in Camunda 8.8.
- Consistency: eventual.

Authentication: bearerAuth or basicAuth

Parameters:
  roleId (path, RoleId, required)

Request body:
  application/json: RoleGroupSearchQueryRequest
    sort (RoleGroupSearchQuerySortRequest[]) — Sort field criteria.

Responses:
  200 RoleGroupSearchResult — The groups with assigned role.
  400 ProblemDetail — The provided data is not valid.
  401 ProblemDetail — The request lacks valid authentication credentials.
  403 ProblemDetail — Forbidden. The request is not allowed.
  404 ProblemDetail — The role with the given ID was not found.
  500 ProblemDetail — An internal error occurred while processing the request.

---
Source: https://docs.camunda.io/docs/next/apis-tools/orchestration-cluster-api-rest/specifications/search-groups-for-role.api
