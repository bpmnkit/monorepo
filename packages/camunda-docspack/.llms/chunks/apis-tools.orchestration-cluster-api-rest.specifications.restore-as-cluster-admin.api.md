# Restore one or every physical tenant from a backup

`POST /cluster/v2/restore`

Restores physical tenants from backups. The restore is described either by a list of backup IDs or by a time range (`from`/`to`) that selects the backups to restore. Restores are only accepted while the targeted physical tenants are in recovery mode; requests are rejected otherwise. The request is validated and acknowledged, but the restore itself is performed asynchronously.

If the `physicalTenantId` parameter is provided, only that physical tenant is restored and `overrides` must be omitted.

If it is not provided, every physical tenant of the cluster is restored: those named in `overrides` with their own backup selection, all others with the selection at the top level of the request body.

Requires the cluster-admin security chain. Although this operation lists `bearerAuth` / `basicAuth` like the rest of the Orchestration Cluster API, it does not accept an Orchestration Cluster user's credentials — only the separate cluster-admin credentials are valid here.

- Added in Camunda 8.10.
- Consistency: strong.

Authentication: bearerAuth or basicAuth

Parameters:
  physicalTenantId (query, string)
  dryRun (query, boolean)

Request body:
  application/json: ClusterRestoreRequest (required)
    overrides (object) — The backup selection to apply to individual physical tenants, keyed by physical tenant id. Only allowed for a cluster-wide restore, that is when no…

Responses:
  202 ClusterRestoreResponse — The restore request was accepted; returns the planned cluster change covering every requested physical tenant.
  400 ProblemDetail — The provided data is not valid.
  401 ProblemDetail — The request lacks valid authentication credentials.
  404 ProblemDetail — The requested `physicalTenantId`, or a physical tenant named in `overrides`, does not exist in this cluster.
  409 — A targeted physical tenant is not in recovery mode, so the restore cannot be accepted.
  500 ProblemDetail — An internal error occurred while processing the request.

---
Source: https://docs.camunda.io/docs/next/apis-tools/orchestration-cluster-api-rest/specifications/restore-as-cluster-admin.api
