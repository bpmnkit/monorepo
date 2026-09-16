# Suspend process instance

`POST /process-instances/{processInstanceKey}/suspension`

Suspends a running process instance, pausing further processing until it is resumed.
Only process instances in the ACTIVE state can be suspended.

- Required permissions: SUSPEND_PROCESS_INSTANCE on PROCESS_DEFINITION.
- Added in Camunda 8.10.
- Consistency: strong.

Authentication: bearerAuth or basicAuth

Parameters:
  processInstanceKey (path, string, required)

Request body:
  application/json: SuspendProcessInstanceRequest
    operationReference (OperationReference)

Responses:
  204 — The process instance is suspended.
  400 ProblemDetail — The provided data is not valid.
  404 ProblemDetail — The process instance is not found.
  409 ProblemDetail — The process instance is not in the ACTIVE state and cannot be suspended. More details are provided in the response body.
  500 ProblemDetail — An internal error occurred while processing the request.
  503 ProblemDetail — The service is currently unavailable. This may happen only on some requests where the system creates backpressure to prevent the server's compute resources from being exhausted, avoiding more severe failures. In this case, the title of the error object contains `RESOURCE_EXHAUSTED`. Clients are recommended to eventually retry those requests after a backoff period. You can learn more about the backpressure mechanism here: https://docs.camunda.io/docs/components/zeebe/technical-concepts/internal-processing/#handling-backpressure .

---
Source: https://docs.camunda.io/docs/next/apis-tools/orchestration-cluster-api-rest/specifications/suspend-process-instance.api
