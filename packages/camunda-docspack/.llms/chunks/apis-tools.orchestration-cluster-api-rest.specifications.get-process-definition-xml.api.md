# Get process definition XML

`GET /process-definitions/{processDefinitionKey}/xml`

Returns process definition as XML.

- Required permissions: READ_PROCESS_DEFINITION on PROCESS_DEFINITION.
- Added in Camunda 8.8.
- Consistency: eventual.

Authentication: bearerAuth or basicAuth

Parameters:
  processDefinitionKey (path, string, required)

Responses:
  200 string — The XML of the process definition is successfully returned.
  204 string — The process definition was found but does not have XML.
  400 ProblemDetail — The provided data is not valid.
  401 ProblemDetail — The request lacks valid authentication credentials.
  403 ProblemDetail — Forbidden. The request is not allowed.
  404 ProblemDetail — The process definition with the given key was not found. More details are provided in the response body.
  500 ProblemDetail — An internal error occurred while processing the request.

---
Source: https://docs.camunda.io/docs/next/apis-tools/orchestration-cluster-api-rest/specifications/get-process-definition-xml.api
