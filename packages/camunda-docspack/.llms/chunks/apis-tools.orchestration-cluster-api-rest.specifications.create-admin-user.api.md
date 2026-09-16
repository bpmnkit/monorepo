# Create admin user

`POST /setup/user`

Creates a new user and assigns the admin role to it. This endpoint is only usable when users are managed in the Orchestration Cluster and while no user is assigned to the admin role.

- Added in Camunda 8.8.
- Consistency: strong.

Request body:
  application/json: UserRequest (required)
    password (string, required) — The password of the user.
    username (Username, required) — The username of the new user.
    name (string) — The name of the user.
    email (string) — The email of the user.

Responses:
  201 UserCreateResult — The admin user was created successfully.
  400 ProblemDetail — The provided data is not valid.
  403 ProblemDetail — Forbidden. The request is not allowed.
  409 ProblemDetail — A user with this username already exists.
  500 ProblemDetail — An internal error occurred while processing the request.
  503 ProblemDetail — The service is currently unavailable. This may happen only on some requests where the system creates backpressure to prevent the server's compute resources from being exhausted, avoiding more severe failures. In this case, the title of the error object contains `RESOURCE_EXHAUSTED`. Clients are recommended to eventually retry those requests after a backoff period. You can learn more about the backpressure mechanism here: https://docs.camunda.io/docs/components/zeebe/technical-concepts/internal-processing/#handling-backpressure .

---
Source: https://docs.camunda.io/docs/next/apis-tools/orchestration-cluster-api-rest/specifications/create-admin-user.api
