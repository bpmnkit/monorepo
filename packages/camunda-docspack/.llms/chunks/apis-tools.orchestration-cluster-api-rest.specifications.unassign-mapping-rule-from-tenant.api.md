# Unassign a mapping rule from a tenant

`DELETE /tenants/{tenantId}/mapping-rules/{mappingRuleId}`

Unassigns a single mapping rule from a specified tenant without deleting the rule.

- Required permissions: UPDATE on TENANT.
- Added in Camunda 8.8.
- Consistency: strong.

Authentication: bearerAuth or basicAuth

Parameters:
  tenantId (path, TenantId, required)
  mappingRuleId (path, MappingRuleId, required)

Responses:
  204 — The mapping rule was successfully unassigned from the tenant.
  400 ProblemDetail — The provided data is not valid.
  403 ProblemDetail — Forbidden. The request is not allowed.
  404 ProblemDetail — Not found. The tenant or mapping rule was not found.
  500 ProblemDetail — An internal error occurred while processing the request.
  503 ProblemDetail — The service is currently unavailable. This may happen only on some requests where the system creates backpressure to prevent the server's compute resources from being exhausted, avoiding more severe failures. In this case, the title of the error object contains `RESOURCE_EXHAUSTED`. Clients are recommended to eventually retry those requests after a backoff period. You can learn more about the backpressure mechanism here: https://docs.camunda.io/docs/components/zeebe/technical-concepts/internal-processing/#handling-backpressure .

---
Source: https://docs.camunda.io/docs/next/apis-tools/orchestration-cluster-api-rest/specifications/unassign-mapping-rule-from-tenant.api
