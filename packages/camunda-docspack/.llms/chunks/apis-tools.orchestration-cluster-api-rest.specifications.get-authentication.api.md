# Get current user

`GET /authentication/me`

Retrieves the current authenticated user.

- Added in Camunda 8.8.
- Consistency: strong.

Authentication: bearerAuth

Responses:
  200 CamundaUserResult — The current user is successfully returned.
  401 ProblemDetail — The request lacks valid authentication credentials.
  403 ProblemDetail — Forbidden. The request is not allowed.
  500 ProblemDetail — An internal error occurred while processing the request.

---
Source: https://docs.camunda.io/docs/next/apis-tools/orchestration-cluster-api-rest/specifications/get-authentication.api
