# Modify process instances (batch)

`POST /process-instances/modification`

Modify multiple process instances.
Since only process instances with ACTIVE state can be modified, any given
filters for state are ignored and overridden during this batch operation.
In contrast to single modification operation, it is not possible to add variable instructions or modify by element key.
It is only possible to use the element id of the source and target.
This is done asynchronously, the progress can be tracked using the batchOperationKey from the response and the batch operation status endpoint (/batch-operations/{batchOperationKey}).

- Added in Camunda 8.8.
- Consistency: strong.

Authentication: bearerAuth or basicAuth

Request body:
  application/json: ProcessInstanceModificationBatchOperationRequest (required)
    filter (ProcessInstanceFilter, required) — The process instance filter.
    moveInstructions (ProcessInstanceModificationMoveBatchOperationInstruction[], required) — Instructions for moving tokens between elements.
    operationReference (OperationReference)

Responses:
  200 BatchOperationCreatedResult — The batch operation request was created.
  400 ProblemDetail — The process instance batch operation failed. More details are provided in the response body.
  401 ProblemDetail — The request lacks valid authentication credentials.
  403 ProblemDetail — Forbidden. The request is not allowed.
  500 ProblemDetail — An internal error occurred while processing the request.

---
Source: https://docs.camunda.io/docs/next/apis-tools/orchestration-cluster-api-rest/specifications/modify-process-instances-batch-operation.api
