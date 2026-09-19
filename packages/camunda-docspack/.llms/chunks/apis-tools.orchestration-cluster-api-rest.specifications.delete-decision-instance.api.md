# Delete decision instance

`POST /decision-instances/{decisionEvaluationKey}/deletion`

Delete all associated decision evaluations based on provided key.

- Required permissions: DELETE_DECISION_INSTANCE on DECISION_DEFINITION.
- Added in Camunda 8.9.
- Consistency: strong.

Authentication: bearerAuth or basicAuth

Parameters:
  decisionEvaluationKey (path, string, required)

Request body:
  application/json: DeleteDecisionInstanceRequest
    operationReference (OperationReference)

Responses:
  204 — The decision instance is marked for deletion.
  401 ProblemDetail — The request lacks valid authentication credentials.
  403 ProblemDetail — Forbidden. The request is not allowed.
  404 ProblemDetail — The decision instance is not found.
  500 ProblemDetail — An internal error occurred while processing the request.
  503 ProblemDetail — The service is currently unavailable. This may happen only on some requests where the system creates backpressure to prevent the server's compute resources from being exhausted, avoiding more severe failures. In this case, the title of the error object contains `RESOURCE_EXHAUSTED`. Clients are recommended to eventually retry those requests after a backoff period. You can learn more about the backpressure mechanism here: https://docs.camunda.io/docs/components/zeebe/technical-concepts/internal-processing/#handling-backpressure .

---
Source: https://docs.camunda.io/docs/next/apis-tools/orchestration-cluster-api-rest/specifications/delete-decision-instance.api
