# Update mapping rule

`PUT /mapping-rules/{mappingRuleId}`

Update a mapping rule.

- Required permissions: UPDATE on MAPPING_RULE.
- Added in Camunda 8.8.
- Consistency: strong.

Authentication: bearerAuth or basicAuth

Parameters:
  mappingRuleId (path, MappingRuleId, required)

Request body:
  application/json: MappingRuleUpdateRequest

Responses:
  200 MappingRuleUpdateResult — The mapping rule was updated successfully.
  400 ProblemDetail — The provided data is not valid.
  403 ProblemDetail — The request to update a mapping rule was denied. More details are provided in the response body.
  404 ProblemDetail — The request to update a mapping rule was denied.
  500 ProblemDetail — An internal error occurred while processing the request.
  503 ProblemDetail — The service is currently unavailable. This may happen only on some requests where the system creates backpressure to prevent the server's compute resources from being exhausted, avoiding more severe failures. In this case, the title of the error object contains `RESOURCE_EXHAUSTED`. Clients are recommended to eventually retry those requests after a backoff period. You can learn more about the backpressure mechanism here: https://docs.camunda.io/docs/components/zeebe/technical-concepts/internal-processing/#handling-backpressure .

---
Source: https://docs.camunda.io/docs/next/apis-tools/orchestration-cluster-api-rest/specifications/update-mapping-rule.api
