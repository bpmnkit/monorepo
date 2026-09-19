# Unassign a user from a group

`DELETE /groups/{groupId}/users/{username}`

Unassigns a user from a group.
The user is removed as a group member, with associated authorizations, roles, and tenant assignments no longer applied.

- Required permissions: UPDATE on GROUP.
- Added in Camunda 8.8.
- Consistency: strong.

Authentication: bearerAuth or basicAuth

Parameters:
  groupId (path, GroupId, required)
  username (path, Username, required)

Responses:
  204 — The user was unassigned successfully from the group.
  400 ProblemDetail — The provided data is not valid.
  403 ProblemDetail — Forbidden. The request is not allowed.
  404 ProblemDetail — The group or user with the given ID was not found, or the user is not assigned to this group.
  500 ProblemDetail — An internal error occurred while processing the request.
  503 ProblemDetail — The service is currently unavailable. This may happen only on some requests where the system creates backpressure to prevent the server's compute resources from being exhausted, avoiding more severe failures. In this case, the title of the error object contains `RESOURCE_EXHAUSTED`. Clients are recommended to eventually retry those requests after a backoff period. You can learn more about the backpressure mechanism here: https://docs.camunda.io/docs/components/zeebe/technical-concepts/internal-processing/#handling-backpressure .

---
Source: https://docs.camunda.io/docs/next/apis-tools/orchestration-cluster-api-rest/specifications/unassign-user-from-group.api
