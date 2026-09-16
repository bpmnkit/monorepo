# Search process instances

`POST /process-instances/search`

Search for process instances based on given criteria.

- Required permissions: READ_PROCESS_INSTANCE on PROCESS_DEFINITION.
- Added in Camunda 8.6.
- Consistency: eventual.

Authentication: bearerAuth or basicAuth

Request body:
  application/json: ProcessInstanceSearchQuery
    sort (ProcessInstanceSearchQuerySortRequest[]) — Sort field criteria.
    filter (ProcessInstanceFilter) — The process instance search filters.

Responses:
  200 ProcessInstanceSearchQueryResult — The process instance search result.
  400 ProblemDetail — The provided data is not valid.
  401 ProblemDetail — The request lacks valid authentication credentials.
  403 ProblemDetail — Forbidden. The request is not allowed.
  500 ProblemDetail — An internal error occurred while processing the request.

---
Source: https://docs.camunda.io/docs/next/apis-tools/orchestration-cluster-api-rest/specifications/search-process-instances.api
