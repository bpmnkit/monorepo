# Create tenant

`POST /tenants`

Creates a new tenant.

- Required permissions: CREATE on TENANT.
- Added in Camunda 8.8.
- Consistency: strong.

Authentication: bearerAuth or basicAuth

Request body:
  application/json: TenantCreateRequest (required)
    tenantId (TenantId, required) — The unique ID for the tenant. Must be 31 characters or less and match `^[\w.-]{1,31} (word characters, `.`, `-`). The literal `<default>` is also accepted as…
    name (string, required) — The name of the tenant.
    description (string) — The description of the tenant.

Responses:
  201 TenantCreateResult — The tenant was created successfully.
  400 ProblemDetail — The provided data is not valid.
  403 ProblemDetail — Forbidden. The request is not allowed.
  404 ProblemDetail — Not found. The resource was not found.
  409 ProblemDetail — Tenant with this id already exists.
  500 ProblemDetail — An internal error occurred while processing the request.
  503 ProblemDetail — The service is currently unavailable. This may happen only on some requests where the system creates backpressure to prevent the server's compute resources from being exhausted, avoiding more severe failures. In this case, the title of the error object contains `RESOURCE_EXHAUSTED`. Clients are recommended to eventually retry those requests after a backoff period. You can learn more about the backpressure mechanism here: https://docs.camunda.io/docs/components/zeebe/technical-concepts/internal-processing/#handling-backpressure .

---
Source: https://docs.camunda.io/docs/next/apis-tools/orchestration-cluster-api-rest/specifications/create-tenant.api
