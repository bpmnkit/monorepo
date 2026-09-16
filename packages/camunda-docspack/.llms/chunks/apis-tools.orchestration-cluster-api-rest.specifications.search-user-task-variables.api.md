# Search user task variables

`POST /user-tasks/{userTaskKey}/variables/search`

Search for user task variables based on given criteria. This endpoint returns all variable
documents visible from the user task's scope, including variables from parent scopes in the
scope hierarchy. If the same variable name exists at multiple scope levels, each scope's
variable is returned as a separate result. Use the
`/user-tasks/{userTaskKey}/effective-variables/search` endpoint to get deduplicated variables
where the innermost scope takes precedence. By default, long variable values in the response
are truncated.

- Required permissions: READ_PROCESS_INSTANCE on PROCESS_DEFINITION.
- Added in Camunda 8.8.
- Consistency: eventual.

Authentication: bearerAuth or basicAuth

Parameters:
  userTaskKey (path, string, required)
  truncateValues (query, boolean)

Request body:
  application/json: UserTaskVariableSearchQueryRequest
    sort (UserTaskVariableSearchQuerySortRequest[]) — Sort field criteria.
    filter (UserTaskVariableFilter) — The user task variable search filters.

Responses:
  200 VariableSearchQueryResult — The user task variable search result.
  400 ProblemDetail — The provided data is not valid.
  500 ProblemDetail — An internal error occurred while processing the request.

---
Source: https://docs.camunda.io/docs/next/apis-tools/orchestration-cluster-api-rest/specifications/search-user-task-variables.api
