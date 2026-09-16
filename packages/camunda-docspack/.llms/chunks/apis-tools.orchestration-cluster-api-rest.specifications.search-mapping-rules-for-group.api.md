# Search group mapping rules

`POST /groups/{groupId}/mapping-rules/search`

Search mapping rules assigned to a group.

- Required permissions: READ on MAPPING_RULE.
- Added in Camunda 8.8.
- Consistency: eventual.

Authentication: bearerAuth or basicAuth

Parameters:
  groupId (path, GroupId, required)

Request body:
  application/json: MappingRuleSearchQueryRequest
    sort (MappingRuleSearchQuerySortRequest[]) — Sort field criteria.
    filter (MappingRuleFilter) — The mapping rule search filters.

Responses:
  200 GroupMappingRuleSearchResult — The mapping rules assigned to the group.
  400 ProblemDetail — The provided data is not valid.
  401 ProblemDetail — The request lacks valid authentication credentials.
  403 ProblemDetail — Forbidden. The request is not allowed.
  404 ProblemDetail — The group with the given ID was not found.
  500 ProblemDetail — An internal error occurred while processing the request.

---
Source: https://docs.camunda.io/docs/next/apis-tools/orchestration-cluster-api-rest/specifications/search-mapping-rules-for-group.api
