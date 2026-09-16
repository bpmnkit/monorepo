# Assign a user to a group

`PUT /groups/{groupId}/users/{username}`

Assigns a user to a group, making the user a member of the group.
Group members inherit the group authorizations, roles, and tenant assignments.

- Required permissions: UPDATE on GROUP.
- Added in Camunda 8.8.
- Consistency: strong.

Authentication: bearerAuth or basicAuth

Parameters:
  groupId (path, GroupId, required)
  username (path, Username, required)

Responses:
  204 — The user was assigned successfully to the group.
  400 ProblemDetail — The provided data is not valid.
  403 ProblemDetail — Forbidden. The request is not allowed.
  404 ProblemDetail — The group or user with the given ID or username was not found.
  409 ProblemDetail — The user with the given ID is already assigned to the group.
  500 ProblemDetail — An internal error occurred while processing the request.
  503 ProblemDetail — The service is currently unavailable. This may happen only on some requests where the system creates backpressure to prevent the server's compute resources from being exhausted, avoiding more severe failures. In this case, the title of the error object contains `RESOURCE_EXHAUSTED`. Clients are recommended to eventually retry those requests after a backoff period. You can learn more about the backpressure mechanism here: https://docs.camunda.io/docs/components/zeebe/technical-concepts/internal-processing/#handling-backpressure .

---
Source: https://docs.camunda.io/docs/next/apis-tools/orchestration-cluster-api-rest/specifications/assign-user-to-group.api
