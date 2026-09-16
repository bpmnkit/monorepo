# Resolve related incidents

`POST /process-instances/{processInstanceKey}/incident-resolution`

Creates a batch operation to resolve multiple incidents of a process instance.

- Required permissions: UPDATE_PROCESS_INSTANCE on PROCESS_DEFINITION.
- Added in Camunda 8.9.
- Consistency: strong.

Authentication: bearerAuth or basicAuth

Parameters:
  processInstanceKey (path, string, required)

Responses:
  200 BatchOperationCreatedResult — The batch operation request for incident resolution was created.
  400 ProblemDetail — The provided data is not valid.
  401 ProblemDetail — The request lacks valid authentication credentials.
  404 ProblemDetail — The process instance is not found.
  500 ProblemDetail — An internal error occurred while processing the request.
  503 ProblemDetail — The service is currently unavailable. This may happen only on some requests where the system creates backpressure to prevent the server's compute resources from being exhausted, avoiding more severe failures. In this case, the title of the error object contains `RESOURCE_EXHAUSTED`. Clients are recommended to eventually retry those requests after a backoff period. You can learn more about the backpressure mechanism here: https://docs.camunda.io/docs/components/zeebe/technical-concepts/internal-processing/#handling-backpressure .

---
Source: https://docs.camunda.io/docs/next/apis-tools/orchestration-cluster-api-rest/specifications/resolve-process-instance-incidents.api
