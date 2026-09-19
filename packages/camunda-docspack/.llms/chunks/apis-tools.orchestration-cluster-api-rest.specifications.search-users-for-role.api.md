# Search role users

`POST /roles/{roleId}/users/search`

Search users with assigned role.

- Required permissions: READ on ROLE.
- Added in Camunda 8.8.
- Consistency: eventual.

Authentication: bearerAuth or basicAuth

Parameters:
  roleId (path, RoleId, required)

Request body:
  application/json: RoleUserSearchQueryRequest
    sort (RoleUserSearchQuerySortRequest[]) — Sort field criteria.

Responses:
  200 RoleUserSearchResult — The users with the assigned role.
  400 ProblemDetail — The provided data is not valid.
  401 ProblemDetail — The request lacks valid authentication credentials.
  403 ProblemDetail — Forbidden. The request is not allowed.
  404 ProblemDetail — The role with the given ID was not found.
  500 ProblemDetail — An internal error occurred while processing the request.

---
Source: https://docs.camunda.io/docs/next/apis-tools/orchestration-cluster-api-rest/specifications/search-users-for-role.api
