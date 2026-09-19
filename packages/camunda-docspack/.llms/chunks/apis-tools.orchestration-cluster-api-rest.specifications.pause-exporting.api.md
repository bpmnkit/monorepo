# Pause exporting

`POST /exporting/pause`

Pauses exporting on all partitions of the physical tenant. While paused, exported records
are not committed, so the log is not compacted for the affected partitions.

With `soft=true`, exporting continues to run but its position is not committed, so the
state after resuming is identical to a hard pause; use this variant when exporting must
keep progressing (e.g. to avoid falling behind) while still preventing log compaction,
such as during a backup.

- Required permissions: PAUSE on EXPORTER.
- Added in Camunda 8.10.
- Consistency: strong.

Authentication: bearerAuth or basicAuth

Parameters:
  soft (query, boolean)

Responses:
  204 — Exporting was successfully paused.
  401 ProblemDetail — The request lacks valid authentication credentials.
  403 ProblemDetail — Forbidden. The request is not allowed.
  500 ProblemDetail — An internal error occurred while processing the request.
  503 ProblemDetail — The service is currently unavailable. This may happen only on some requests where the system creates backpressure to prevent the server's compute resources from being exhausted, avoiding more severe failures. In this case, the title of the error object contains `RESOURCE_EXHAUSTED`. Clients are recommended to eventually retry those requests after a backoff period. You can learn more about the backpressure mechanism here: https://docs.camunda.io/docs/components/zeebe/technical-concepts/internal-processing/#handling-backpressure .

---
Source: https://docs.camunda.io/docs/next/apis-tools/orchestration-cluster-api-rest/specifications/pause-exporting.api
