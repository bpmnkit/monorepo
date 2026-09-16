# Update jobs (batch)

`POST /jobs/batch-update`

Creates a batch operation to update jobs matching the given filter. At least one changeset field must be non-null. This is done asynchronously; the progress can be tracked using the batchOperationKey from the response and the batch operation status endpoint (/batch-operations/{batchOperationKey}).

- Added in Camunda 8.10.
- Consistency: strong.

Authentication: bearerAuth or basicAuth

Request body:
  application/json: JobBatchUpdateRequest (required)
    filter (JobFilter, required) — The job filter. At least one dimension must be set.
    changeset (JobChangeset, required) — The fields to update. At least one field must be non-null.
    operationReference (OperationReference)

Responses:
  200 BatchOperationCreatedResult — The batch operation was created.
  400 ProblemDetail — The job batch update operation failed. More details are provided in the response body.
  401 ProblemDetail — The request lacks valid authentication credentials.
  403 ProblemDetail — Forbidden. The request is not allowed.
  500 ProblemDetail — An internal error occurred while processing the request.

---
Source: https://docs.camunda.io/docs/next/apis-tools/orchestration-cluster-api-rest/specifications/update-jobs-batch-operation.api
