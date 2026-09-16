# Get runtime backup state

`GET /backups/runtime/state`

Returns the current checkpoint and backup state of every partition of the physical
tenant. Unlike the `backupRuntime` actuator, this fails the whole request if the
checkpoint state or the backup ranges cannot be retrieved from any partition, instead
of silently returning an empty section.

- Required permissions: READ on BACKUP.
- Added in Camunda 8.10.
- Consistency: strong.

Authentication: bearerAuth or basicAuth

Responses:
  200 RuntimeBackupState — The runtime backup state.
  401 ProblemDetail — The request lacks valid authentication credentials.
  403 ProblemDetail — Forbidden. The request is not allowed.
  500 ProblemDetail — An internal error occurred while processing the request.
  503 ProblemDetail — The service is currently unavailable. This may happen only on some requests where the system creates backpressure to prevent the server's compute resources from being exhausted, avoiding more severe failures. In this case, the title of the error object contains `RESOURCE_EXHAUSTED`. Clients are recommended to eventually retry those requests after a backoff period. You can learn more about the backpressure mechanism here: https://docs.camunda.io/docs/components/zeebe/technical-concepts/internal-processing/#handling-backpressure .

---
Source: https://docs.camunda.io/docs/next/apis-tools/orchestration-cluster-api-rest/specifications/get-runtime-backup-state.api
