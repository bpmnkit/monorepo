# Get decision definition XML

`GET /decision-definitions/{decisionDefinitionKey}/xml`

Returns decision definition as XML.

- Required permissions: READ_DECISION_DEFINITION on DECISION_DEFINITION.
- Added in Camunda 8.6.
- Consistency: eventual.

Authentication: bearerAuth or basicAuth

Parameters:
  decisionDefinitionKey (path, string, required)

Responses:
  200 string — The XML of the decision definition is successfully returned.
  400 ProblemDetail — The provided data is not valid.
  401 ProblemDetail — The request lacks valid authentication credentials.
  403 ProblemDetail — Forbidden. The request is not allowed.
  404 ProblemDetail — The decision definition with the given key was not found. More details are provided in the response body.
  500 ProblemDetail — An internal error occurred while processing the request.

---
Source: https://docs.camunda.io/docs/next/apis-tools/orchestration-cluster-api-rest/specifications/get-decision-definition-xml.api
