# Delete process instances (batch)

`POST /process-instances/deletion`

Delete multiple process instances. This will delete the historic data from secondary storage.
Only process instances in a final state (COMPLETED or TERMINATED) can be deleted.
This is done asynchronously, the progress can be tracked using the batchOperationKey from the response and the batch operation status endpoint (/batch-operations/{batchOperationKey}).

- Added in Camunda 8.9.
- Consistency: strong.

Authentication: bearerAuth or basicAuth

Request body:
  application/json: ProcessInstanceDeletionBatchOperationRequest (required)
    filter (ProcessInstanceFilter, required) — The process instance filter.
    operationReference (OperationReference)

Responses:
  200 BatchOperationCreatedResult — The batch operation request was created.
  400 ProblemDetail — The process instance batch operation failed. More details are provided in the response body.
  401 ProblemDetail — The request lacks valid authentication credentials.
  403 ProblemDetail — Forbidden. The request is not allowed.
  500 ProblemDetail — An internal error occurred while processing the request.

---
Source: https://docs.camunda.io/docs/next/apis-tools/orchestration-cluster-api-rest/specifications/delete-process-instances-batch-operation.api
