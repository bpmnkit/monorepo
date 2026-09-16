# Search element instances

`POST /element-instances/search`

Search for element instances based on given criteria.

- Required permissions: READ_PROCESS_INSTANCE on PROCESS_DEFINITION.
- Added in Camunda 8.8.
- Consistency: eventual.

Authentication: bearerAuth or basicAuth

Request body:
  application/json: ElementInstanceSearchQuery
    sort (ElementInstanceSearchQuerySortRequest[]) — Sort field criteria.
    filter (ElementInstanceFilter) — The element instance search filters.

Responses:
  200 ElementInstanceSearchQueryResult — The element instance search result.
  400 ProblemDetail — The provided data is not valid.
  401 ProblemDetail — The request lacks valid authentication credentials.
  403 ProblemDetail — Forbidden. The request is not allowed.
  500 ProblemDetail — An internal error occurred while processing the request.

---
Source: https://docs.camunda.io/docs/next/apis-tools/orchestration-cluster-api-rest/specifications/search-element-instances.api
