# Create mapping rule

`POST /mapping-rules`

Create a new mapping rule

- Required permissions: CREATE on MAPPING_RULE.
- Added in Camunda 8.8.
- Consistency: strong.

Authentication: bearerAuth or basicAuth

Request body:
  application/json: MappingRuleCreateRequest
    mappingRuleId (MappingRuleId, required) — The unique ID of the mapping rule.

Responses:
  201 MappingRuleCreateResult — The mapping rule was created successfully.
  400 ProblemDetail — The provided data is not valid.
  403 ProblemDetail — The request to create a mapping rule was denied. More details are provided in the response body.
  404 ProblemDetail — The request to create a mapping rule was denied.
  409 ProblemDetail — Mapping rule with this id already exists.
  500 ProblemDetail — An internal error occurred while processing the request.

---
Source: https://docs.camunda.io/docs/next/apis-tools/orchestration-cluster-api-rest/specifications/create-mapping-rule.api
