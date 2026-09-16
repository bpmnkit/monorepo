# Get authorization

`GET /authorizations/{authorizationKey}`

Get authorization by the given key.

- Required permissions: READ on AUTHORIZATION.
- Added in Camunda 8.8.
- Consistency: eventual.

Authentication: bearerAuth or basicAuth

Parameters:
  authorizationKey (path, AuthorizationKey, required)

Responses:
  200 AuthorizationResult — The authorization was successfully returned.
  401 ProblemDetail — The request lacks valid authentication credentials.
  403 ProblemDetail — Forbidden. The request is not allowed.
  404 ProblemDetail — The authorization with the given key was not found.
  500 ProblemDetail — An internal error occurred while processing the request.

---
Source: https://docs.camunda.io/docs/next/apis-tools/orchestration-cluster-api-rest/specifications/get-authorization.api
