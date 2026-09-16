# Restore from a backup

`POST /restore`

Restores the cluster from a backup. The restore is described either by a single backup ID or by a time range (`from`/`to`) that selects the backups to restore. This endpoint is only accessible while the cluster is in recovery mode; requests are rejected otherwise. The request is validated and acknowledged, but the restore itself is performed asynchronously.

- Required permissions: RESTORE on BACKUP.
- Added in Camunda 8.10.
- Consistency: strong.

Authentication: bearerAuth or basicAuth

Parameters:
  dryRun (query, boolean)

Request body:
  application/json: RestoreRequest (required)
    from (string) — The start of the time range to restore from, as an ISO 8601 timestamp.
    to (string) — The end of the time range to restore from, as an ISO 8601 timestamp.
    backupIds (integer[]) — The IDs of the backups to restore from, one per partition.

Responses:
  202 ClusterRestoreResponse — The restore request was accepted; returns the planned cluster changes.
  400 ProblemDetail — The provided data is not valid.
  401 ProblemDetail — The request lacks valid authentication credentials.
  403 ProblemDetail — Forbidden. The request is not allowed.
  409 — The cluster is not in recovery mode, so the restore cannot be accepted.
  500 ProblemDetail — An internal error occurred while processing the request.

---
Source: https://docs.camunda.io/docs/next/apis-tools/orchestration-cluster-api-rest/specifications/restore.api
