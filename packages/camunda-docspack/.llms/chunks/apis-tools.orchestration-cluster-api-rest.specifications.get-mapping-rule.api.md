# Get a mapping rule

`GET /mapping-rules/{mappingRuleId}`

Gets the mapping rule with the given ID.

- Required permissions: READ on MAPPING_RULE.
- Added in Camunda 8.8.
- Consistency: eventual.

Authentication: bearerAuth or basicAuth

Parameters:
  mappingRuleId (path, MappingRuleId, required)

Responses:
  200 MappingRuleResult — The mapping rule was returned successfully.
  401 ProblemDetail — The request lacks valid authentication credentials.
  404 ProblemDetail — The mapping rule with the mappingRuleId was not found.
  500 ProblemDetail — An internal error occurred while processing the request.

---
Source: https://docs.camunda.io/docs/next/apis-tools/orchestration-cluster-api-rest/specifications/get-mapping-rule.api
