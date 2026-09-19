# Get the status of the restore that is currently in progress

`GET /restore`

Returns the status of the restore that is currently in progress, reported per broker and per partition. There is at most one restore in flight at any time. Once the restore has finished this endpoint returns 404; the per-partition detail is not retained after completion.

- Required permissions: RESTORE on BACKUP.
- Added in Camunda 8.10.
- Consistency: strong.

Authentication: bearerAuth or basicAuth

Responses:
  200 RestoreStatusResponse — The status of the restore that is currently in progress.
  401 ProblemDetail — The request lacks valid authentication credentials.
  403 ProblemDetail — Forbidden. The request is not allowed.
  404 — No restore is currently in progress.
  500 ProblemDetail — An internal error occurred while processing the request.

---
Source: https://docs.camunda.io/docs/next/apis-tools/orchestration-cluster-api-rest/specifications/get-restore-status.api
