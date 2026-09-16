# Get form by key

`GET /forms/{formKey}`

Get a form by its unique form key.

- Required permissions: READ on RESOURCE.
- Added in Camunda 8.10.
- Consistency: eventual.

Authentication: bearerAuth or basicAuth

Parameters:
  formKey (path, string, required)

Responses:
  200 FormResult — The form is successfully returned.
  400 ProblemDetail — The provided data is not valid.
  401 ProblemDetail — The request lacks valid authentication credentials.
  403 ProblemDetail — Forbidden. The request is not allowed.
  404 ProblemDetail — The form with the given key was not found.
  500 ProblemDetail — An internal error occurred while processing the request.

---
Source: https://docs.camunda.io/docs/next/apis-tools/orchestration-cluster-api-rest/specifications/get-form-by-key.api
