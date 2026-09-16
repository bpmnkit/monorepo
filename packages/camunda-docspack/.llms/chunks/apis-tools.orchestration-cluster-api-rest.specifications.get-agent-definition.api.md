# Get agent definition

`GET /agent-definitions/{agentDefinitionKey}`

Returns an agent definition by key.

- Required permissions: READ_PROCESS_DEFINITION on PROCESS_DEFINITION.
- Added in Camunda 8.10.
- Consistency: eventual.

Authentication: bearerAuth or basicAuth

Parameters:
  agentDefinitionKey (path, string, required)

Responses:
  200 AgentDefinitionResult — The agent definition is successfully returned.
  400 ProblemDetail — The provided data is not valid.
  401 ProblemDetail — The request lacks valid authentication credentials.
  403 ProblemDetail — Forbidden. The request is not allowed.
  404 ProblemDetail — The agent definition with the given key was not found. More details are provided in the response body.
  500 ProblemDetail — An internal error occurred while processing the request.

---
Source: https://docs.camunda.io/docs/next/apis-tools/orchestration-cluster-api-rest/specifications/get-agent-definition.api
