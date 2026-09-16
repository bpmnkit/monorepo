# Get decision definition

`GET /decision-definitions/{decisionDefinitionKey}`

Returns a decision definition by key.

- Required permissions: READ_DECISION_DEFINITION on DECISION_DEFINITION.
- Added in Camunda 8.8.
- Consistency: eventual.

Authentication: bearerAuth or basicAuth

Parameters:
  decisionDefinitionKey (path, string, required)

Responses:
  200 DecisionDefinitionResult — The decision definition is successfully returned.
  400 ProblemDetail — The provided data is not valid.
  401 ProblemDetail — The request lacks valid authentication credentials.
  403 ProblemDetail — Forbidden. The request is not allowed.
  404 ProblemDetail — The decision definition with the given key was not found. More details are provided in the response body.
  500 ProblemDetail — An internal error occurred while processing the request.

---
Source: https://docs.camunda.io/docs/next/apis-tools/orchestration-cluster-api-rest/specifications/get-decision-definition.api
