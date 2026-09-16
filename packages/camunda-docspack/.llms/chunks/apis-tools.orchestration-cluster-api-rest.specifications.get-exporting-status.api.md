# Get exporting status

`GET /exporting`

Returns the exporting status of the physical tenant, aggregated over every replica of
every one of its partitions.

Because pause and resume are applied to all replicas, the status is only a single phase
if every replica reports that phase; otherwise it is `MIXED`, which means a pause or
resume is still in flight or was only partially applied. Backup tooling should treat
only `PAUSED` and `SOFT_PAUSED` as confirmation that exporting is paused.

- Required permissions: PAUSE on EXPORTER.
- Added in Camunda 8.10.
- Consistency: strong.

Authentication: bearerAuth or basicAuth

Responses:
  200 ExportingStatusResponse — The current exporting status of the physical tenant.
  401 ProblemDetail — The request lacks valid authentication credentials.
  403 ProblemDetail — Forbidden. The request is not allowed.
  500 ProblemDetail — An internal error occurred while processing the request.
  503 ProblemDetail — The service is currently unavailable. This may happen only on some requests where the system creates backpressure to prevent the server's compute resources from being exhausted, avoiding more severe failures. In this case, the title of the error object contains `RESOURCE_EXHAUSTED`. Clients are recommended to eventually retry those requests after a backoff period. You can learn more about the backpressure mechanism here: https://docs.camunda.io/docs/components/zeebe/technical-concepts/internal-processing/#handling-backpressure .

---
Source: https://docs.camunda.io/docs/next/apis-tools/orchestration-cluster-api-rest/specifications/get-exporting-status.api
