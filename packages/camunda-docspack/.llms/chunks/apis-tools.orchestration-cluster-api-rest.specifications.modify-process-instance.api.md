# Modify process instance

`POST /process-instances/{processInstanceKey}/modification`

Modifies a running process instance.
This request can contain multiple instructions to activate an element of the process or
to terminate an active instance of an element.

Use this to repair a process instance that is stuck on an element or took an unintended path.
For example, because an external system is not available or doesn't respond as expected.

- Required permissions: MODIFY_PROCESS_INSTANCE on PROCESS_DEFINITION.
- Added in Camunda 8.6.
- Consistency: strong.

Authentication: bearerAuth or basicAuth

Parameters:
  processInstanceKey (path, string, required)

Request body:
  application/json: ProcessInstanceModificationInstruction (required)
    operationReference (OperationReference)
    activateInstructions (ProcessInstanceModificationActivateInstruction[]) — Instructions describing which elements to activate in which scopes and which variables to create or update.
    moveInstructions (ProcessInstanceModificationMoveInstruction[]) — Instructions describing which elements to move from one scope to another.
    terminateInstructions (ProcessInstanceModificationTerminateInstruction[]) — Instructions describing which elements to terminate.

Responses:
  204 — The process instance is modified.
  400 ProblemDetail — The provided data is not valid.
  404 ProblemDetail — The process instance is not found.
  500 ProblemDetail — An internal error occurred while processing the request.
  503 ProblemDetail — The service is currently unavailable. This may happen only on some requests where the system creates backpressure to prevent the server's compute resources from being exhausted, avoiding more severe failures. In this case, the title of the error object contains `RESOURCE_EXHAUSTED`. Clients are recommended to eventually retry those requests after a backoff period. You can learn more about the backpressure mechanism here: https://docs.camunda.io/docs/components/zeebe/technical-concepts/internal-processing/#handling-backpressure .

---
Source: https://docs.camunda.io/docs/next/apis-tools/orchestration-cluster-api-rest/specifications/modify-process-instance.api
