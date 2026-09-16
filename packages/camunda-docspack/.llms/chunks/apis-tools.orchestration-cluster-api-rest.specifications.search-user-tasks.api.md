# Search user tasks

`POST /user-tasks/search`

Search for user tasks based on given criteria.

- Added in Camunda 8.6.
- Consistency: eventual.

Authentication: bearerAuth or basicAuth

Request body:
  application/json: UserTaskSearchQuery
    sort (UserTaskSearchQuerySortRequest[]) — Sort field criteria.
    filter (UserTaskFilter) — The user task search filters.

Responses:
  200 UserTaskSearchQueryResult — The user task search result.
  400 ProblemDetail — The provided data is not valid.
  401 ProblemDetail — The request lacks valid authentication credentials.
  403 ProblemDetail — Forbidden. The request is not allowed.
  500 ProblemDetail — An internal error occurred while processing the request.

---
Source: https://docs.camunda.io/docs/next/apis-tools/orchestration-cluster-api-rest/specifications/search-user-tasks.api
