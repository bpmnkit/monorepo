# Resolve incident

`POST /incidents/{incidentKey}/resolution`

Marks the incident as resolved; most likely a call to Update job will be necessary
to reset the job's retries, followed by this call.

- Required permissions: UPDATE_PROCESS_INSTANCE on PROCESS_DEFINITION.
- Added in Camunda 8.6.
- Consistency: strong.

Authentication: bearerAuth or basicAuth

Parameters:
  incidentKey (path, string, required)

Request body:
  application/json: IncidentResolutionRequest
    operationReference (OperationReference)

Responses:
  204 — The incident is marked as resolved.
  400 ProblemDetail — The provided data is not valid.
  404 ProblemDetail — The incident with the incidentKey is not found.
  409 ProblemDetail — The incident cannot be resolved due to an invalid state. For example, the associated job may have no retries left.
  500 ProblemDetail — An internal error occurred while processing the request.
  503 ProblemDetail — The service is currently unavailable. This may happen only on some requests where the system creates backpressure to prevent the server's compute resources from being exhausted, avoiding more severe failures. In this case, the title of the error object contains `RESOURCE_EXHAUSTED`. Clients are recommended to eventually retry those requests after a backoff period. You can learn more about the backpressure mechanism here: https://docs.camunda.io/docs/components/zeebe/technical-concepts/internal-processing/#handling-backpressure .

---
Source: https://docs.camunda.io/docs/next/apis-tools/orchestration-cluster-api-rest/specifications/resolve-incident.api
