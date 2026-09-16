# Take a runtime backup

`POST /backups/runtime`

Triggers a backup of runtime data on all partitions of the physical tenant.

The `backupId` must be omitted if continuous backups and/or a backup or checkpoint
schedule is enabled for the physical tenant, as the id is generated automatically.
Otherwise, `backupId` is required.

- Required permissions: CREATE on BACKUP.
- Added in Camunda 8.10.
- Consistency: strong.

Authentication: bearerAuth or basicAuth

Request body:
  application/json: TakeRuntimeBackupRequest
    backupId (BackupId) — The id of the backup to take. Must be omitted if continuous backups and/or a backup or checkpoint schedule is enabled for the physical tenant.

Responses:
  202 TakeRuntimeBackupResponse — The backup has been successfully scheduled.
  400 ProblemDetail — The provided data is not valid.
  401 ProblemDetail — The request lacks valid authentication credentials.
  403 ProblemDetail — Forbidden. The request is not allowed.
  409 ProblemDetail — A backup with the same or a higher id already exists.
  500 ProblemDetail — An internal error occurred while processing the request.
  503 ProblemDetail — The service is currently unavailable. This may happen only on some requests where the system creates backpressure to prevent the server's compute resources from being exhausted, avoiding more severe failures. In this case, the title of the error object contains `RESOURCE_EXHAUSTED`. Clients are recommended to eventually retry those requests after a backoff period. You can learn more about the backpressure mechanism here: https://docs.camunda.io/docs/components/zeebe/technical-concepts/internal-processing/#handling-backpressure .
  504 ProblemDetail — The request from gateway to broker timed out.

---
Source: https://docs.camunda.io/docs/next/apis-tools/orchestration-cluster-api-rest/specifications/take-runtime-backup.api
