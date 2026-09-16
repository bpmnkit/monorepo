# Search user task effective variables

`POST /user-tasks/{userTaskKey}/effective-variables/search`

Search for the effective variables of a user task. This endpoint returns deduplicated
variables where each variable name appears at most once. When the same variable name exists
at multiple scope levels in the scope hierarchy, the value from the innermost scope (closest
to the user task) takes precedence. This is useful for retrieving the actual runtime state
of variables as seen by the user task. By default, long variable values in the response are
truncated.

- Required permissions: READ_PROCESS_INSTANCE on PROCESS_DEFINITION.
- Added in Camunda 8.8.
- Consistency: eventual.

Authentication: bearerAuth or basicAuth

Parameters:
  userTaskKey (path, string, required)
  truncateValues (query, boolean)

Request body:
  application/json: UserTaskEffectiveVariableSearchQueryRequest
    page (OffsetPagination) — Pagination parameters.
    sort (UserTaskVariableSearchQuerySortRequest[]) — Sort field criteria.
    filter (UserTaskVariableFilter) — The user task variable search filters.

Responses:
  200 VariableSearchQueryResult — The user task effective variable search result.
  400 ProblemDetail — The provided data is not valid.
  500 ProblemDetail — An internal error occurred while processing the request.

---
Source: https://docs.camunda.io/docs/next/apis-tools/orchestration-cluster-api-rest/specifications/search-user-task-effective-variables.api
