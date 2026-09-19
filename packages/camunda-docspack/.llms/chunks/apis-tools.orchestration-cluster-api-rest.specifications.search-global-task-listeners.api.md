# Search global user task listeners

`POST /global-task-listeners/search`

Search for global user task listeners based on given criteria.

- Required permissions: READ_TASK_LISTENER on GLOBAL_LISTENER.
- Added in Camunda 8.9.
- Consistency: eventual.

Authentication: bearerAuth or basicAuth

Request body:
  application/json: GlobalTaskListenerSearchQueryRequest
    sort (GlobalTaskListenerSearchQuerySortRequest[]) — Sort field criteria.
    filter (GlobalTaskListenerSearchQueryFilterRequest) — The global listener search filters.

Responses:
  200 GlobalTaskListenerSearchQueryResult — The global user task listener search result.
  400 ProblemDetail — The provided data is not valid.
  401 ProblemDetail — The request lacks valid authentication credentials.
  403 ProblemDetail — Forbidden. The request is not allowed.
  500 ProblemDetail — An internal error occurred while processing the request.

---
Source: https://docs.camunda.io/docs/next/apis-tools/orchestration-cluster-api-rest/specifications/search-global-task-listeners.api
