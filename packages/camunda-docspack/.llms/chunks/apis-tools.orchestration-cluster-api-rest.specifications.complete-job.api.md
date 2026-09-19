# Complete job

`POST /jobs/{jobKey}/completion`

Complete a job with the given payload, which allows completing the associated service task.

- Required permissions: UPDATE_PROCESS_INSTANCE on PROCESS_DEFINITION.
- Added in Camunda 8.6.
- Consistency: strong.

Authentication: bearerAuth or basicAuth

Parameters:
  jobKey (path, string, required)

Request body:
  application/json: JobCompletionRequest
    variables (object) — The variables to complete the job with.
    result (JobResult)
    leaseToken (string) — The token identifying a leased job's activation, obtained from `ActivatedJobResult.leaseToken`. For a leased job, the matching token must be supplied to prove…
    businessId (BusinessId) — An optional business id to assign to the process instance the job belongs to, as part of completing the job, letting a worker set the identifier from work it…

Responses:
  204 — The job was completed successfully.
  400 ProblemDetail — The provided data is not valid.
  404 ProblemDetail — The job with the given key was not found.
  409 ProblemDetail — The job with the given key is in the wrong state currently. More details are provided in the response body.
  500 ProblemDetail — An internal error occurred while processing the request.
  503 ProblemDetail — The service is currently unavailable. This may happen only on some requests where the system creates backpressure to prevent the server's compute resources from being exhausted, avoiding more severe failures. In this case, the title of the error object contains `RESOURCE_EXHAUSTED`. Clients are recommended to eventually retry those requests after a backoff period. You can learn more about the backpressure mechanism here: https://docs.camunda.io/docs/components/zeebe/technical-concepts/internal-processing/#handling-backpressure .

---
Source: https://docs.camunda.io/docs/next/apis-tools/orchestration-cluster-api-rest/specifications/complete-job.api
