# Throw error for job

`POST /jobs/{jobKey}/error`

Reports a business error (i.e. non-technical) that occurs while processing a job.

- Required permissions: UPDATE_PROCESS_INSTANCE on PROCESS_DEFINITION.
- Added in Camunda 8.6.
- Consistency: strong.

Authentication: bearerAuth or basicAuth

Parameters:
  jobKey (path, string, required)

Request body:
  application/json: JobErrorRequest (required)
    errorCode (string, required) — The error code that will be matched with an error catch event.
    errorMessage (string) — An error message that provides additional context.
    variables (object) — JSON object that will instantiate the variables at the local scope of the error catch event that catches the thrown error.
    leaseToken (string) — The token identifying a leased job's activation, obtained from `ActivatedJobResult.leaseToken`. For a leased job, the matching token must be supplied to prove…

Responses:
  204 — An error is thrown for the job.
  400 ProblemDetail — The provided data is not valid.
  404 ProblemDetail — The job with the given key was not found or is not activated.
  409 ProblemDetail — The job with the given key is in the wrong state currently. More details are provided in the response body.
  500 ProblemDetail — An internal error occurred while processing the request.
  503 ProblemDetail — The service is currently unavailable. This may happen only on some requests where the system creates backpressure to prevent the server's compute resources from being exhausted, avoiding more severe failures. In this case, the title of the error object contains `RESOURCE_EXHAUSTED`. Clients are recommended to eventually retry those requests after a backoff period. You can learn more about the backpressure mechanism here: https://docs.camunda.io/docs/components/zeebe/technical-concepts/internal-processing/#handling-backpressure .

---
Source: https://docs.camunda.io/docs/next/apis-tools/orchestration-cluster-api-rest/specifications/throw-job-error.api
