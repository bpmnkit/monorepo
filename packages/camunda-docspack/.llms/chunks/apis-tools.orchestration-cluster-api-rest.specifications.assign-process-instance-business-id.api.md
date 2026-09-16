# Assign business id to process instance

`POST /process-instances/{processInstanceKey}/business-id-assignment`

Assigns a business id to an already-running process instance that currently has none.

The assignment is single and irreversible: only artifacts created after the assignment
(for example future jobs, user tasks, decision instances, and message subscriptions) carry
the business id, while existing artifacts are not retroactively enriched. Re-sending the
same business id succeeds as a no-op. This endpoint is only useful while business id
uniqueness enforcement is disabled; when it is enabled, the request is rejected with a 409
response.

- Required permissions: UPDATE_PROCESS_INSTANCE on PROCESS_DEFINITION.
- Added in Camunda 8.10.
- Consistency: strong.

Authentication: bearerAuth or basicAuth

Parameters:
  processInstanceKey (path, string, required)

Request body:
  application/json: ProcessInstanceBusinessIdAssignmentInstruction (required)
    businessId (BusinessId, required)

Responses:
  204 — The business id is assigned to the process instance.
  400 ProblemDetail — The provided data is not valid.
  404 ProblemDetail — The process instance is not found.
  409 ProblemDetail — The business id assignment failed because the process instance is not eligible, for example it already has a different business id, it is a call-activity child, or business id uniqueness enforcement is enabled. More details are provided in the response body.
  500 ProblemDetail — An internal error occurred while processing the request.
  503 ProblemDetail — The service is currently unavailable. This may happen only on some requests where the system creates backpressure to prevent the server's compute resources from being exhausted, avoiding more severe failures. In this case, the title of the error object contains `RESOURCE_EXHAUSTED`. Clients are recommended to eventually retry those requests after a backoff period. You can learn more about the backpressure mechanism here: https://docs.camunda.io/docs/components/zeebe/technical-concepts/internal-processing/#handling-backpressure .

---
Source: https://docs.camunda.io/docs/next/apis-tools/orchestration-cluster-api-rest/specifications/assign-process-instance-business-id.api
