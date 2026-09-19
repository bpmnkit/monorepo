# searchClusterVariables

`POST /cluster-variables/search`

Search for cluster variables based on given criteria. By default, long variable values in the response are truncated.

- Required permissions: READ on CLUSTER_VARIABLE.
- Added in Camunda 8.9.
- Consistency: eventual.

Authentication: bearerAuth or basicAuth

Parameters:
  truncateValues (query, boolean)

Request body:
  application/json: ClusterVariableSearchQueryRequest
    sort (ClusterVariableSearchQuerySortRequest[]) — Sort field criteria.
    filter (ClusterVariableSearchQueryFilterRequest) — The cluster variable search filters.

Responses:
  200 ClusterVariableSearchQueryResult — The cluster variable search result.
  400 ProblemDetail — The provided data is not valid.
  401 ProblemDetail — The request lacks valid authentication credentials.
  403 ProblemDetail — Forbidden. The request is not allowed.
  500 ProblemDetail — An internal error occurred while processing the request.

---
Source: https://docs.camunda.io/docs/next/apis-tools/orchestration-cluster-api-rest/specifications/search-cluster-variables.api
