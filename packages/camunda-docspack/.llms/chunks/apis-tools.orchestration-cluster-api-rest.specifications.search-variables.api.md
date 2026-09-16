# Search variables

`POST /variables/search`

Search for variables based on given criteria.

This endpoint returns variables that exist directly at the specified scopes - it does not
include variables from parent scopes that would be visible through the scope hierarchy.

Variables can be process-level (scoped to the process instance) or local (scoped to specific
BPMN elements like tasks, subprocesses, etc.).

By default, long variable values in the response are truncated.

- Required permissions: READ_PROCESS_INSTANCE on PROCESS_DEFINITION.
- Added in Camunda 8.8.
- Consistency: eventual.

Authentication: bearerAuth or basicAuth

Parameters:
  truncateValues (query, boolean)

Request body:
  application/json: VariableSearchQuery
    sort (VariableSearchQuerySortRequest[]) — Sort field criteria.
    filter (VariableFilter) — The variable search filters.

Responses:
  200 VariableSearchQueryResult — The variable search result.
  400 ProblemDetail — The provided data is not valid.
  401 ProblemDetail — The request lacks valid authentication credentials.
  403 ProblemDetail — Forbidden. The request is not allowed.
  500 ProblemDetail — An internal error occurred while processing the request.

---
Source: https://docs.camunda.io/docs/next/apis-tools/orchestration-cluster-api-rest/specifications/search-variables.api
