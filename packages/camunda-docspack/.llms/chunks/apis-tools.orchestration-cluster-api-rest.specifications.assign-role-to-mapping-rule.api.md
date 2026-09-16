# Assign a role to a mapping rule

`PUT /roles/{roleId}/mapping-rules/{mappingRuleId}`

Assigns a role to a mapping rule.

- Required permissions: UPDATE on ROLE.
- Added in Camunda 8.8.
- Consistency: strong.

Authentication: bearerAuth or basicAuth

Parameters:
  roleId (path, RoleId, required)
  mappingRuleId (path, MappingRuleId, required)

Responses:
  204 — The role was assigned successfully to the mapping rule.
  400 ProblemDetail — The provided data is not valid.
  403 ProblemDetail — Forbidden. The request is not allowed.
  404 ProblemDetail — The role or mapping rule with the given ID was not found.
  409 ProblemDetail — The role is already assigned to the mapping rule with the given ID.
  500 ProblemDetail — An internal error occurred while processing the request.
  503 ProblemDetail — The service is currently unavailable. This may happen only on some requests where the system creates backpressure to prevent the server's compute resources from being exhausted, avoiding more severe failures. In this case, the title of the error object contains `RESOURCE_EXHAUSTED`. Clients are recommended to eventually retry those requests after a backoff period. You can learn more about the backpressure mechanism here: https://docs.camunda.io/docs/components/zeebe/technical-concepts/internal-processing/#handling-backpressure .

---
Source: https://docs.camunda.io/docs/next/apis-tools/orchestration-cluster-api-rest/specifications/assign-role-to-mapping-rule.api
