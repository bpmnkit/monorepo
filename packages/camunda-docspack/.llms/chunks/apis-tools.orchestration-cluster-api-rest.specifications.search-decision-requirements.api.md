# Search decision requirements

`POST /decision-requirements/search`

Search for decision requirements based on given criteria.

- Required permissions: READ on DECISION_REQUIREMENTS_DEFINITION.
- Added in Camunda 8.6.
- Consistency: eventual.

Authentication: bearerAuth or basicAuth

Request body:
  application/json: DecisionRequirementsSearchQuery
    sort (DecisionRequirementsSearchQuerySortRequest[]) — Sort field criteria.
    filter (DecisionRequirementsFilter) — The decision definition search filters.

Responses:
  200 DecisionRequirementsSearchQueryResult — The decision requirements search result.
  400 ProblemDetail — The provided data is not valid.
  401 ProblemDetail — The request lacks valid authentication credentials.
  403 ProblemDetail — Forbidden. The request is not allowed.
  500 ProblemDetail — An internal error occurred while processing the request.

---
Source: https://docs.camunda.io/docs/next/apis-tools/orchestration-cluster-api-rest/specifications/search-decision-requirements.api
