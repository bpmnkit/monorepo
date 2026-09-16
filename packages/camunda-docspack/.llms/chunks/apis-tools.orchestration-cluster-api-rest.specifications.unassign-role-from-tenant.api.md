# Unassign a role from a tenant

`DELETE /tenants/{tenantId}/roles/{roleId}`

Unassigns a role from a specified tenant.
Users, Clients or Groups, that have the role assigned, will no longer have access to the
tenant's data - unless they are assigned directly to the tenant.

- Required permissions: UPDATE on TENANT.
- Added in Camunda 8.8.
- Consistency: strong.

Authentication: bearerAuth or basicAuth

Parameters:
  tenantId (path, TenantId, required)
  roleId (path, RoleId, required)

Responses:
  204 — The role was successfully unassigned from the tenant.
  400 ProblemDetail — The provided data is not valid.
  403 ProblemDetail — Forbidden. The request is not allowed.
  404 ProblemDetail — Not found. The tenant or role was not found.
  500 ProblemDetail — An internal error occurred while processing the request.
  503 ProblemDetail — The service is currently unavailable. This may happen only on some requests where the system creates backpressure to prevent the server's compute resources from being exhausted, avoiding more severe failures. In this case, the title of the error object contains `RESOURCE_EXHAUSTED`. Clients are recommended to eventually retry those requests after a backoff period. You can learn more about the backpressure mechanism here: https://docs.camunda.io/docs/components/zeebe/technical-concepts/internal-processing/#handling-backpressure .

---
Source: https://docs.camunda.io/docs/next/apis-tools/orchestration-cluster-api-rest/specifications/unassign-role-from-tenant.api
