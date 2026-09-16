# Update job

`PATCH /jobs/{jobKey}`

Update a job with the given key.

- Required permissions: UPDATE_PROCESS_INSTANCE on PROCESS_DEFINITION.
- Added in Camunda 8.6.
- Consistency: strong.

Authentication: bearerAuth or basicAuth

Parameters:
  jobKey (path, string, required)

Request body:
  application/json: JobUpdateRequest (required)
    changeset (JobChangeset, required)
    operationReference (OperationReference)
    leaseToken (string) — The token identifying a leased job's activation, obtained from `ActivatedJobResult.leaseToken`. For a leased job, a supplied token is validated to prove the…

Responses:
  204 — The job was updated successfully.
  400 ProblemDetail — The provided data is not valid.
  404 ProblemDetail — The job with the jobKey is not found.
  409 ProblemDetail — The job with the given key is in the wrong state currently. More details are provided in the response body.
  500 ProblemDetail — An internal error occurred while processing the request.
  503 ProblemDetail — The service is currently unavailable. This may happen only on some requests where the system creates backpressure to prevent the server's compute resources from being exhausted, avoiding more severe failures. In this case, the title of the error object contains `RESOURCE_EXHAUSTED`. Clients are recommended to eventually retry those requests after a backoff period. You can learn more about the backpressure mechanism here: https://docs.camunda.io/docs/components/zeebe/technical-concepts/internal-processing/#handling-backpressure .

---
Source: https://docs.camunda.io/docs/next/apis-tools/orchestration-cluster-api-rest/specifications/update-job.api
