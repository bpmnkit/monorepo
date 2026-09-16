# Unassign a user from a tenant

`DELETE /tenants/{tenantId}/users/{username}`

Unassigns the user from the specified tenant.
The user can no longer access tenant data.

- Required permissions: UPDATE on TENANT.
- Added in Camunda 8.8.
- Consistency: strong.

Authentication: bearerAuth or basicAuth

Parameters:
  tenantId (path, TenantId, required)
  username (path, Username, required)

Responses:
  204 — The user was successfully unassigned from the tenant.
  400 ProblemDetail — The provided data is not valid.
  403 ProblemDetail — Forbidden. The request is not allowed.
  404 ProblemDetail — Not found. The tenant or user was not found.
  500 ProblemDetail — An internal error occurred while processing the request.
  503 ProblemDetail — The service is currently unavailable. This may happen only on some requests where the system creates backpressure to prevent the server's compute resources from being exhausted, avoiding more severe failures. In this case, the title of the error object contains `RESOURCE_EXHAUSTED`. Clients are recommended to eventually retry those requests after a backoff period. You can learn more about the backpressure mechanism here: https://docs.camunda.io/docs/components/zeebe/technical-concepts/internal-processing/#handling-backpressure .

---
Source: https://docs.camunda.io/docs/next/apis-tools/orchestration-cluster-api-rest/specifications/unassign-user-from-tenant.api
