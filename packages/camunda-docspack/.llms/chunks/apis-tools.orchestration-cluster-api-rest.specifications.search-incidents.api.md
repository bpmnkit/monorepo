# Search incidents

`POST /incidents/search`

Search for incidents based on given criteria.

- Required permissions: READ_PROCESS_INSTANCE on PROCESS_DEFINITION.
- Added in Camunda 8.6.
- Consistency: eventual.

Authentication: bearerAuth or basicAuth

Request body:
  application/json: IncidentSearchQuery
    sort (IncidentSearchQuerySortRequest[]) — Sort field criteria.
    filter (IncidentFilter) — The incident search filters.

Responses:
  200 IncidentSearchQueryResult — The incident search result.
  400 ProblemDetail — The provided data is not valid.
  401 ProblemDetail — The request lacks valid authentication credentials.
  403 ProblemDetail — Forbidden. The request is not allowed.
  500 ProblemDetail — An internal error occurred while processing the request.

---
Source: https://docs.camunda.io/docs/next/apis-tools/orchestration-cluster-api-rest/specifications/search-incidents.api
