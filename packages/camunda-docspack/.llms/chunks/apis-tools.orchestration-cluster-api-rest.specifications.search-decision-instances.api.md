# Search decision instances

`POST /decision-instances/search`

Search for decision instances based on given criteria.

- Required permissions: READ_DECISION_INSTANCE on DECISION_DEFINITION.
- Added in Camunda 8.6.
- Consistency: eventual.

Authentication: bearerAuth or basicAuth

Request body:
  application/json: DecisionInstanceSearchQuery
    sort (DecisionInstanceSearchQuerySortRequest[]) — Sort field criteria.
    filter (DecisionInstanceFilter) — The decision instance search filters.

Responses:
  200 DecisionInstanceSearchQueryResult — The decision instance search result.
  400 ProblemDetail — The provided data is not valid.
  401 ProblemDetail — The request lacks valid authentication credentials.
  403 ProblemDetail — Forbidden. The request is not allowed.
  500 ProblemDetail — An internal error occurred while processing the request.

---
Source: https://docs.camunda.io/docs/next/apis-tools/orchestration-cluster-api-rest/specifications/search-decision-instances.api
