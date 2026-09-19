# Search mapping rules

`POST /mapping-rules/search`

Search for mapping rules based on given criteria.

- Required permissions: READ on MAPPING_RULE.
- Added in Camunda 8.8.
- Consistency: eventual.

Authentication: bearerAuth or basicAuth

Request body:
  application/json: MappingRuleSearchQueryRequest
    sort (MappingRuleSearchQuerySortRequest[]) — Sort field criteria.
    filter (MappingRuleFilter) — The mapping rule search filters.

Responses:
  200 MappingRuleSearchQueryResult — The mapping rule search result.
  400 ProblemDetail — The provided data is not valid.
  401 ProblemDetail — The request lacks valid authentication credentials.
  403 ProblemDetail — Forbidden. The request is not allowed.
  500 ProblemDetail — An internal error occurred while processing the request.

---
Source: https://docs.camunda.io/docs/next/apis-tools/orchestration-cluster-api-rest/specifications/search-mapping-rule.api
