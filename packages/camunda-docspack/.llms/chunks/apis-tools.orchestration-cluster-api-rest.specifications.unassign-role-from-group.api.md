# Unassign a role from a group

`DELETE /roles/{roleId}/groups/{groupId}`

Unassigns the specified role from the group. All group members (user or client) no longer inherit the authorizations associated with this role.

- Required permissions: UPDATE on ROLE.
- Added in Camunda 8.8.
- Consistency: strong.

Authentication: bearerAuth or basicAuth

Parameters:
  roleId (path, RoleId, required)
  groupId (path, GroupId, required)

Responses:
  204 — The role was unassigned successfully from the group.
  400 ProblemDetail — The provided data is not valid.
  403 ProblemDetail — Forbidden. The request is not allowed.
  404 ProblemDetail — The role or group with the given ID was not found.
  500 ProblemDetail — An internal error occurred while processing the request.
  503 ProblemDetail — The service is currently unavailable. This may happen only on some requests where the system creates backpressure to prevent the server's compute resources from being exhausted, avoiding more severe failures. In this case, the title of the error object contains `RESOURCE_EXHAUSTED`. Clients are recommended to eventually retry those requests after a backoff period. You can learn more about the backpressure mechanism here: https://docs.camunda.io/docs/components/zeebe/technical-concepts/internal-processing/#handling-backpressure .

---
Source: https://docs.camunda.io/docs/next/apis-tools/orchestration-cluster-api-rest/specifications/unassign-role-from-group.api
