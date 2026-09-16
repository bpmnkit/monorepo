# Activate jobs

`POST /jobs/activation`

Iterate through all known partitions and activate jobs up to the requested maximum.

- Required permissions: UPDATE_PROCESS_INSTANCE on PROCESS_DEFINITION.
- Added in Camunda 8.6.
- Consistency: strong.

Authentication: bearerAuth or basicAuth

Request body:
  application/json: JobActivationRequest (required)
    type (string, required) — The job type, as defined in the BPMN process (e.g. <zeebe:taskDefinition type="payment-service" />)
    worker (string) — The name of the worker activating the jobs, mostly used for logging purposes.
    timeout (integer, required) — A job returned after this call will not be activated by another call until the timeout (in ms) has been reached.
    maxJobsToActivate (integer, required) — The maximum jobs to activate by this request.
    fetchVariable (string[]) — A list of variables to fetch as the job variables; if empty, all visible variables at the time of activation for the scope of the job will be returned.
    requestTimeout (integer) — The request will be completed when at least one job is activated or after the requestTimeout (in ms). If the requestTimeout = 0, a default timeout is used. If…
    tenantIds (TenantId[]) — A list of IDs of tenants for which to activate jobs.
    tenantFilter (TenantFilterEnum) — The tenant filtering strategy - determines whether to use provided tenant IDs or assigned tenant IDs from the authenticated principal's authorized tenants.
    withLease (boolean) — Whether to activate the jobs with a lease. When true, each activated job is assigned a distinct, opaque lease token, returned as ActivatedJobResult.leaseToken.…

Responses:
  200 JobActivationResult — The list of activated jobs.
  400 ProblemDetail — The provided data is not valid.
  401 ProblemDetail — The request lacks valid authentication credentials.
  500 ProblemDetail — An internal error occurred while processing the request.
  503 ProblemDetail — The service is currently unavailable. This may happen only on some requests where the system creates backpressure to prevent the server's compute resources from being exhausted, avoiding more severe failures. In this case, the title of the error object contains `RESOURCE_EXHAUSTED`. Clients are recommended to eventually retry those requests after a backoff period. You can learn more about the backpressure mechanism here: https://docs.camunda.io/docs/components/zeebe/technical-concepts/internal-processing/#handling-backpressure .

---
Source: https://docs.camunda.io/docs/next/apis-tools/orchestration-cluster-api-rest/specifications/activate-jobs.api
