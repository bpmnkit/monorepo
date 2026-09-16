# Evaluate root level conditional start events

`POST /conditionals/evaluation`

Evaluates root-level conditional start events for process definitions.
If the evaluation is successful, it will return the keys of all created process instances, along with their associated process definition key.
Multiple root-level conditional start events of the same process definition can trigger if their conditions evaluate to true.

- Required permissions: CREATE_PROCESS_INSTANCE on PROCESS_DEFINITION.
- Added in Camunda 8.9.
- Consistency: strong.

Authentication: bearerAuth or basicAuth

Request body:
  application/json: ConditionalEvaluationInstruction (required)
    tenantId (TenantId) — Used to evaluate root-level conditional start events for a tenant with the given ID. This will only evaluate root-level conditional start events of process…
    processDefinitionKey (ProcessDefinitionKey) — Used to evaluate root-level conditional start events of the process definition with the given key.
    variables (object, required) — JSON object representing the variables to use for evaluation of the conditions and to pass to the process instances that have been triggered.

Responses:
  200 EvaluateConditionalResult — Successfully evaluated root-level conditional start events.
  400 ProblemDetail — The provided data is not valid.
  403 ProblemDetail — The client is not authorized to start process instances for the specified process definition. If a processDefinitionKey is not provided, this indicates that the client is not authorized to start process instances for at least one of the matched process definitions.
  404 ProblemDetail — The process definition was not found for the given processDefinitionKey.
  500 ProblemDetail — An internal error occurred while processing the request.
  503 ProblemDetail — The service is currently unavailable. This may happen only on some requests where the system creates backpressure to prevent the server's compute resources from being exhausted, avoiding more severe failures. In this case, the title of the error object contains `RESOURCE_EXHAUSTED`. Clients are recommended to eventually retry those requests after a backoff period. You can learn more about the backpressure mechanism here: https://docs.camunda.io/docs/components/zeebe/technical-concepts/internal-processing/#handling-backpressure .

---
Source: https://docs.camunda.io/docs/next/apis-tools/orchestration-cluster-api-rest/specifications/evaluate-conditionals.api
