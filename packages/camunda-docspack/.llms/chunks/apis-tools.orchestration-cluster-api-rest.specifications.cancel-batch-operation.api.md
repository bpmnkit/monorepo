# Cancel Batch operation

`POST /batch-operations/{batchOperationKey}/cancellation`

Cancels a running batch operation.
This is done asynchronously, the progress can be tracked using the batch operation status endpoint (/batch-operations/{batchOperationKey}).

- Required permissions: UPDATE on BATCH.
- Added in Camunda 8.8.
- Consistency: strong.

Authentication: bearerAuth or basicAuth

Parameters:
  batchOperationKey (path, BatchOperationKey, required)

Request body:
  application/json: 

Responses:
  204 — The batch operation cancel request was created.
  400 ProblemDetail — The provided data is not valid.
  403 ProblemDetail — Forbidden. The request is not allowed.
  404 ProblemDetail — Not found. The batch operation was not found.
  500 ProblemDetail — An internal error occurred while processing the request.

---
Source: https://docs.camunda.io/docs/next/apis-tools/orchestration-cluster-api-rest/specifications/cancel-batch-operation.api
