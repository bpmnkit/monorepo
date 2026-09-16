# Get role

`GET /roles/{roleId}`

Get a role by its ID.

- Required permissions: READ on ROLE.
- Added in Camunda 8.8.
- Consistency: eventual.

Authentication: bearerAuth or basicAuth

Parameters:
  roleId (path, RoleId, required)

Responses:
  200 RoleResult — The role is successfully returned.
  401 ProblemDetail — The request lacks valid authentication credentials.
  403 ProblemDetail — Forbidden. The request is not allowed.
  404 ProblemDetail — The role with the given ID was not found.
  500 ProblemDetail — An internal error occurred while processing the request.

---
Source: https://docs.camunda.io/docs/next/apis-tools/orchestration-cluster-api-rest/specifications/get-role.api
