# Create agent instance

`POST /agent-instances`

Creates a new agent instance. The returned key identifies the instance and must
be used in subsequent update and query calls.

- Required permissions: UPDATE_PROCESS_INSTANCE on PROCESS_DEFINITION.
- Added in Camunda 8.10.
- Consistency: strong.

Authentication: bearerAuth or basicAuth

Request body:
  application/json: AgentInstanceCreationRequest (required)
    elementInstanceKey (ElementInstanceKey, required) — The key of the AI Agent Sub-process or AI Agent Task element instance. The engine uses this key to infer processInstanceKey, elementId, processDefinitionKey,…
    definition (AgentInstanceDefinition, required) — Static definition set once at creation.
    limits (AgentInstanceLimits) — Limits for the agent execution. When omitted, all limits default to -1 (no limit).

Responses:
  200 AgentInstanceCreationResult — The agent instance was created.
  400 ProblemDetail — The provided data is not valid.
  401 ProblemDetail — The request lacks valid authentication credentials.
  403 ProblemDetail — Forbidden. The request is not allowed.
  404 ProblemDetail — The elementInstanceKey does not correspond to an active element instance. More details are provided in the response body.
  409 ProblemDetail — An agent instance already exists for the given element instance.
  500 ProblemDetail — An internal error occurred while processing the request.
  503 ProblemDetail — The service is currently unavailable. This may happen only on some requests where the system creates backpressure to prevent the server's compute resources from being exhausted, avoiding more severe failures. In this case, the title of the error object contains `RESOURCE_EXHAUSTED`. Clients are recommended to eventually retry those requests after a backoff period. You can learn more about the backpressure mechanism here: https://docs.camunda.io/docs/components/zeebe/technical-concepts/internal-processing/#handling-backpressure .

---
Source: https://docs.camunda.io/docs/next/apis-tools/orchestration-cluster-api-rest/specifications/create-agent-instance.api
