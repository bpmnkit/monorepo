# Search element instance wait states

`POST /element-instances/wait-states/search`

Returns the wait states for element instances matching the given filter.

- Required permissions: READ_PROCESS_INSTANCE on PROCESS_DEFINITION.
- Added in Camunda 8.10.
- Consistency: eventual.

Authentication: bearerAuth or basicAuth

Request body:
  application/json: ElementInstanceWaitStateQuery
    sort (ElementInstanceWaitStateQuerySortRequest[]) — Sort field criteria.
    filter (ElementInstanceWaitStateFilter) — Filter criteria for the inspection.

Responses:
  200 ElementInstanceWaitStateQueryResult — The element instance wait state search result.
  400 ProblemDetail — The provided data is not valid.
  401 ProblemDetail — The request lacks valid authentication credentials.
  403 ProblemDetail — Forbidden. The request is not allowed.
  500 ProblemDetail — An internal error occurred while processing the request.

---
Source: https://docs.camunda.io/docs/next/apis-tools/orchestration-cluster-api-rest/specifications/search-element-instance-wait-states.api
