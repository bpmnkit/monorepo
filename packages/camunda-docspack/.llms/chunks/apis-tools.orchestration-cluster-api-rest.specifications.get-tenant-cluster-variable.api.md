# Get a tenant-scoped cluster variable

`GET /cluster-variables/tenants/{tenantId}/{name}`

Get a tenant-scoped cluster variable.

- Required permissions: READ on CLUSTER_VARIABLE.
- Added in Camunda 8.9.
- Consistency: eventual.

Authentication: bearerAuth or basicAuth

Parameters:
  tenantId (path, TenantId, required)
  name (path, ClusterVariableName, required)

Responses:
  200 ClusterVariableResult — Cluster variable found
  400 ProblemDetail — The provided data is not valid.
  401 ProblemDetail — The request lacks valid authentication credentials.
  403 ProblemDetail — Forbidden. The request is not allowed.
  404 ProblemDetail — Cluster variable not found
  500 ProblemDetail — An internal error occurred while processing the request.

---
Source: https://docs.camunda.io/docs/next/apis-tools/orchestration-cluster-api-rest/specifications/get-tenant-cluster-variable.api
