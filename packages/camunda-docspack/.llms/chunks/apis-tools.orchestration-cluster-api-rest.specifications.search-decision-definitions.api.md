# Search decision definitions

`POST /decision-definitions/search`

Search for decision definitions based on given criteria.

- Required permissions: READ_DECISION_DEFINITION on DECISION_DEFINITION.
- Added in Camunda 8.6.
- Consistency: eventual.

Authentication: bearerAuth or basicAuth

Request body:
  application/json: DecisionDefinitionSearchQuery
    sort (DecisionDefinitionSearchQuerySortRequest[]) — Sort field criteria.
    filter (DecisionDefinitionFilter) — The decision definition search filters.

Responses:
  200 DecisionDefinitionSearchQueryResult — The decision definition search result.
  400 ProblemDetail — The provided data is not valid.
  401 ProblemDetail — The request lacks valid authentication credentials.
  403 ProblemDetail — Forbidden. The request is not allowed.
  500 ProblemDetail — An internal error occurred while processing the request.

---
Source: https://docs.camunda.io/docs/next/apis-tools/orchestration-cluster-api-rest/specifications/search-decision-definitions.api
