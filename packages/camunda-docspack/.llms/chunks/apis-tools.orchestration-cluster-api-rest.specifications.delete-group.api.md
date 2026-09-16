# Delete group

`DELETE /groups/{groupId}`

Deletes the group with the given ID.

- Required permissions: DELETE on GROUP.
- Added in Camunda 8.8.
- Consistency: strong.

Authentication: bearerAuth or basicAuth

Parameters:
  groupId (path, GroupId, required)

Responses:
  204 — The group was deleted successfully.
  401 ProblemDetail — The request lacks valid authentication credentials.
  404 ProblemDetail — The group with the given ID was not found.
  500 ProblemDetail — An internal error occurred while processing the request.
  503 ProblemDetail — The service is currently unavailable. This may happen only on some requests where the system creates backpressure to prevent the server's compute resources from being exhausted, avoiding more severe failures. In this case, the title of the error object contains `RESOURCE_EXHAUSTED`. Clients are recommended to eventually retry those requests after a backoff period. You can learn more about the backpressure mechanism here: https://docs.camunda.io/docs/components/zeebe/technical-concepts/internal-processing/#handling-backpressure .

---
Source: https://docs.camunda.io/docs/next/apis-tools/orchestration-cluster-api-rest/specifications/delete-group.api
