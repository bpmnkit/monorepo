# Get history backup

`GET /backups/history/{backupId}`

Returns detailed status of the history backup with the given id.

Only available on clusters whose secondary storage is Elasticsearch or OpenSearch.

- Required permissions: READ on BACKUP.
- Added in Camunda 8.10.
- Consistency: strong.

Authentication: bearerAuth or basicAuth

Parameters:
  backupId (path, BackupId, required)

Responses:
  200 HistoryBackupInfo — The history backup.
  401 ProblemDetail — The request lacks valid authentication credentials.
  403 ProblemDetail — The request is forbidden, either because the authenticated caller lacks the required `BACKUP` permission, or because the cluster's secondary storage is neither Elasticsearch nor OpenSearch and therefore cannot serve history backups. The problem detail says which of the two applies.
  404 ProblemDetail — A backup with the given id does not exist.
  500 ProblemDetail — An internal error occurred while processing the request.
  503 ProblemDetail — The service is currently unavailable. This may happen only on some requests where the system creates backpressure to prevent the server's compute resources from being exhausted, avoiding more severe failures. In this case, the title of the error object contains `RESOURCE_EXHAUSTED`. Clients are recommended to eventually retry those requests after a backoff period. You can learn more about the backpressure mechanism here: https://docs.camunda.io/docs/components/zeebe/technical-concepts/internal-processing/#handling-backpressure .

---
Source: https://docs.camunda.io/docs/next/apis-tools/orchestration-cluster-api-rest/specifications/get-history-backup.api
