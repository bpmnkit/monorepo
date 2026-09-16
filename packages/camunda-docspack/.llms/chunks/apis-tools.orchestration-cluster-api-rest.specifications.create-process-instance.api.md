# Create process instance

`POST /process-instances`

Creates and starts an instance of the specified process.
The process definition to use to create the instance can be specified either using its unique key
(as returned by Deploy resources), or using the BPMN process id and a version.

Waits for the completion of the process instance before returning a result
when awaitCompletion is enabled.

- Required permissions: CREATE_PROCESS_INSTANCE on PROCESS_DEFINITION.
- Added in Camunda 8.6.
- Consistency: strong.

Authentication: bearerAuth or basicAuth

Request body:
  application/json: ProcessInstanceCreationInstruction (required)

Responses:
  200 CreateProcessInstanceResult — The process instance was created.
  400 ProblemDetail — The provided data is not valid.
  409 ProblemDetail — The process instance creation was rejected due to a business ID uniqueness conflict. This can happen only when Business ID Uniqueness Control is enabled and an active root process instance with the provided business ID already exists for the same process definition and tenant.
  500 ProblemDetail — An internal error occurred while processing the request.
  503 ProblemDetail — The service is currently unavailable. This may happen only on some requests where the system creates backpressure to prevent the server's compute resources from being exhausted, avoiding more severe failures. In this case, the title of the error object contains `RESOURCE_EXHAUSTED`. Clients are recommended to eventually retry those requests after a backoff period. You can learn more about the backpressure mechanism here: https://docs.camunda.io/docs/components/zeebe/technical-concepts/internal-processing/#handling-backpressure .
  504 ProblemDetail — The process instance creation request timed out in the gateway. This can happen if the `awaitCompletion` request parameter is set to `true` and the created process instance did not complete within the defined request timeout. This often happens when the created instance is not fully automated or contains wait states.

---
Source: https://docs.camunda.io/docs/next/apis-tools/orchestration-cluster-api-rest/specifications/create-process-instance.api
