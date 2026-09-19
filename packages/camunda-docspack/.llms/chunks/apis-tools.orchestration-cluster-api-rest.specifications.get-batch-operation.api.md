# Get batch operation

`GET /batch-operations/{batchOperationKey}`

Get batch operation by key.

- Required permissions: READ on BATCH.
- Added in Camunda 8.8.
- Consistency: eventual.

Authentication: bearerAuth or basicAuth

Parameters:
  batchOperationKey (path, BatchOperationKey, required)

Responses:
  200 BatchOperationResponse — The batch operation was found.
  400 ProblemDetail — The provided data is not valid.
  404 ProblemDetail — The batch operation is not found.
  500 ProblemDetail — An internal error occurred while processing the request.

---
Source: https://docs.camunda.io/docs/next/apis-tools/orchestration-cluster-api-rest/specifications/get-batch-operation.api
