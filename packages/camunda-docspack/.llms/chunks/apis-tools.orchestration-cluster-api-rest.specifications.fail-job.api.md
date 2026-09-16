# Fail job

`POST /jobs/{jobKey}/failure`

Mark the job as failed.

- Required permissions: UPDATE_PROCESS_INSTANCE on PROCESS_DEFINITION.
- Added in Camunda 8.6.
- Consistency: strong.

Authentication: bearerAuth or basicAuth

Parameters:
  jobKey (path, string, required)

Request body:
  application/json: JobFailRequest
    retries (integer) — The amount of retries the job should have left
    errorMessage (string) — An optional error message describing why the job failed; if not provided, an empty string is used.
    retryBackOff (integer) — An optional retry back off for the failed job. The job will not be retryable before the current time plus the back off time. The default is 0 which means the…
    variables (object) — JSON object that will instantiate the variables at the local scope of the job's associated task.
    leaseToken (string) — The token identifying a leased job's activation, obtained from `ActivatedJobResult.leaseToken`. For a leased job, the matching token must be supplied to prove…

Responses:
  204 — The job is failed.
  400 ProblemDetail — The provided data is not valid.
  404 ProblemDetail — The job with the given jobKey is not found. It was completed by another worker, or the process instance itself was canceled.
  409 ProblemDetail — The job with the given key is in the wrong state (i.e: not ACTIVATED or ACTIVATABLE). The job was failed by another worker with retries = 0, and the process is now in an incident state.
  500 ProblemDetail — An internal error occurred while processing the request.
  503 ProblemDetail — The service is currently unavailable. This may happen only on some requests where the system creates backpressure to prevent the server's compute resources from being exhausted, avoiding more severe failures. In this case, the title of the error object contains `RESOURCE_EXHAUSTED`. Clients are recommended to eventually retry those requests after a backoff period. You can learn more about the backpressure mechanism here: https://docs.camunda.io/docs/components/zeebe/technical-concepts/internal-processing/#handling-backpressure .

---
Source: https://docs.camunda.io/docs/next/apis-tools/orchestration-cluster-api-rest/specifications/fail-job.api
