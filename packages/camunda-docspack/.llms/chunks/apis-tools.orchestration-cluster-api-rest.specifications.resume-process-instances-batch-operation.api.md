# Resume process instances (batch)

`POST /process-instances/resumption`

Resumes multiple suspended process instances.
Since only SUSPENDED root instances can be resumed, any given
filters for state and parentProcessInstanceKey are ignored and overridden during this batch operation.
This is done asynchronously, the progress can be tracked using the batchOperationKey from the response and the batch operation status endpoint (/batch-operations/{batchOperationKey}).

- Added in Camunda 8.10.
- Consistency: strong.

Authentication: bearerAuth or basicAuth

Request body:
  application/json: ProcessInstanceResumptionBatchOperationRequest (required)
    filter (ProcessInstanceFilter, required) — The process instance filter.
    operationReference (OperationReference)

Responses:
  200 BatchOperationCreatedResult — The batch operation request was created.
  400 ProblemDetail — The process instance batch operation failed. More details are provided in the response body.
  401 ProblemDetail — The request lacks valid authentication credentials.
  403 ProblemDetail — Forbidden. The request is not allowed.
  500 ProblemDetail — An internal error occurred while processing the request.

---
Source: https://docs.camunda.io/docs/next/apis-tools/orchestration-cluster-api-rest/specifications/resume-process-instances-batch-operation.api
