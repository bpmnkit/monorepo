# Get group

`GET /groups/{groupId}`

Get a group by its ID.

- Required permissions: READ on GROUP.
- Added in Camunda 8.8.
- Consistency: eventual.

Authentication: bearerAuth or basicAuth

Parameters:
  groupId (path, GroupId, required)

Responses:
  200 GroupResult — The group is successfully returned.
  401 ProblemDetail — The request lacks valid authentication credentials.
  403 ProblemDetail — Forbidden. The request is not allowed.
  404 ProblemDetail — The group with the given ID was not found.
  500 ProblemDetail — An internal error occurred while processing the request.

---
Source: https://docs.camunda.io/docs/next/apis-tools/orchestration-cluster-api-rest/specifications/get-group.api
