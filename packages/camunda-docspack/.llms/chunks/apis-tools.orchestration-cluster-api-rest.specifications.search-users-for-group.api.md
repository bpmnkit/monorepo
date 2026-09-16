# Search group users

`POST /groups/{groupId}/users/search`

Search users assigned to a group.

- Required permissions: READ on GROUP.
- Added in Camunda 8.8.
- Consistency: eventual.

Authentication: bearerAuth or basicAuth

Parameters:
  groupId (path, GroupId, required)

Request body:
  application/json: GroupUserSearchQueryRequest
    sort (GroupUserSearchQuerySortRequest[]) — Sort field criteria.

Responses:
  200 GroupUserSearchResult — The users assigned to the group.
  400 ProblemDetail — The provided data is not valid.
  401 ProblemDetail — The request lacks valid authentication credentials.
  403 ProblemDetail — Forbidden. The request is not allowed.
  404 ProblemDetail — The group with the given ID was not found.
  500 ProblemDetail — An internal error occurred while processing the request.

---
Source: https://docs.camunda.io/docs/next/apis-tools/orchestration-cluster-api-rest/specifications/search-users-for-group.api
