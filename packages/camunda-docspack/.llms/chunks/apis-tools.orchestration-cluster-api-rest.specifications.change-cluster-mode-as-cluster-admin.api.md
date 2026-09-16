# Change the cluster mode of one or every physical tenant

`PATCH /cluster/v2/mode`

Transitions physical tenants between processing and recovery mode.

If the `physicalTenantId` parameter is not provided, all available physical tenants are transitioned individually.

Requires the cluster-admin security chain. Although this operation lists `bearerAuth` / `basicAuth` like the rest of the Orchestration Cluster API, it does not accept an Orchestration Cluster user's credentials — only the separate cluster-admin credentials are valid here.

- Added in Camunda 8.10.
- Consistency: strong.

Authentication: bearerAuth or basicAuth

Parameters:
  mode (query, Mode, required)
  physicalTenantId (query, string)
  dryRun (query, boolean)

Responses:
  200 ClusterModeChangeResponse — The mode change request was accepted; returns the planned cluster change covering every requested physical tenant.
  400 ProblemDetail — The provided data is not valid.
  401 ProblemDetail — The request lacks valid authentication credentials.
  404 ProblemDetail — The requested `physicalTenantId` does not exist in this cluster.
  409 — The mode change conflicts with the cluster state, for example because another configuration change is in progress.
  500 ProblemDetail — An internal error occurred while processing the request.

---
Source: https://docs.camunda.io/docs/next/apis-tools/orchestration-cluster-api-rest/specifications/change-cluster-mode-as-cluster-admin.api
