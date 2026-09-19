# Get decision requirements

`GET /decision-requirements/{decisionRequirementsKey}`

Returns Decision Requirements as JSON.

- Required permissions: READ on DECISION_REQUIREMENTS_DEFINITION.
- Added in Camunda 8.8.
- Consistency: eventual.

Authentication: bearerAuth or basicAuth

Parameters:
  decisionRequirementsKey (path, string, required)

Responses:
  200 DecisionRequirementsResult — The decision requirements is successfully returned.
  400 ProblemDetail — The provided data is not valid.
  401 ProblemDetail — The request lacks valid authentication credentials.
  403 ProblemDetail — Forbidden. The request is not allowed.
  404 ProblemDetail — The decision requirements with the given key was not found. More details are provided in the response body.
  500 ProblemDetail — An internal error occurred while processing the request.

---
Source: https://docs.camunda.io/docs/next/apis-tools/orchestration-cluster-api-rest/specifications/get-decision-requirements.api
