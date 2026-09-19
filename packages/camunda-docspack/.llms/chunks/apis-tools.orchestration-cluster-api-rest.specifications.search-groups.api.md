# Search groups

`POST /groups/search`

Search for groups based on given criteria.

- Required permissions: READ on GROUP.
- Added in Camunda 8.8.
- Consistency: eventual.

Authentication: bearerAuth or basicAuth

Request body:
  application/json: GroupSearchQueryRequest
    sort (GroupSearchQuerySortRequest[]) — Sort field criteria.
    filter (GroupFilter) — The group search filters.

Responses:
  200 GroupSearchQueryResult — The groups search result.
  400 ProblemDetail — The provided data is not valid.
  401 ProblemDetail — The request lacks valid authentication credentials.
  403 ProblemDetail — Forbidden. The request is not allowed.
  500 ProblemDetail — An internal error occurred while processing the request.

---
Source: https://docs.camunda.io/docs/next/apis-tools/orchestration-cluster-api-rest/specifications/search-groups.api
