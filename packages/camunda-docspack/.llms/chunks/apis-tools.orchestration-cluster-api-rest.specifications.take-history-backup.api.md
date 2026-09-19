# Take a history backup

`POST /backups/history`

Triggers a backup of the physical tenant's history, by scheduling a snapshot of every
secondary storage index it owns.

Unlike runtime backups, history backups have no generated-id mode: `backupId` is always
required.

Only available on clusters whose secondary storage is Elasticsearch or OpenSearch.

- Required permissions: CREATE on BACKUP.
- Added in Camunda 8.10.
- Consistency: strong.

Authentication: bearerAuth or basicAuth

Request body:
  application/json: TakeHistoryBackupRequest (required)
    backupId (BackupId, required) — The id of the backup to take.

Responses:
  202 TakeHistoryBackupResponse — The backup has been successfully scheduled.
  400 ProblemDetail — The provided data is not valid.
  401 ProblemDetail — The request lacks valid authentication credentials.
  403 ProblemDetail — The request is forbidden, either because the authenticated caller lacks the required `BACKUP` permission, or because the cluster's secondary storage is neither Elasticsearch nor OpenSearch and therefore cannot serve history backups. The problem detail says which of the two applies.
  409 ProblemDetail — A backup with the given id already exists, or another backup is already running. The "already running" check is best-effort and node-local: it only observes backups started by the gateway that serves the request. Two concurrent requests reaching different gateways are narrowed by the duplicate-id check alone.
  500 ProblemDetail — An internal error occurred while processing the request.
  503 ProblemDetail — The service is currently unavailable. This may happen only on some requests where the system creates backpressure to prevent the server's compute resources from being exhausted, avoiding more severe failures. In this case, the title of the error object contains `RESOURCE_EXHAUSTED`. Clients are recommended to eventually retry those requests after a backoff period. You can learn more about the backpressure mechanism here: https://docs.camunda.io/docs/components/zeebe/technical-concepts/internal-processing/#handling-backpressure .

---
Source: https://docs.camunda.io/docs/next/apis-tools/orchestration-cluster-api-rest/specifications/take-history-backup.api
