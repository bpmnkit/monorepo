# Get the status of the whole cluster

`GET /cluster/v2/status`

Checks the health status of the whole cluster, aggregated over all physical tenants. Returns `HEALTHY` when every physical tenant is healthy, `DOWN` when no physical tenant can process work, and `DEGRADED` in every other case. No per-tenant detail is reported; use `GET /cluster/v2/topology` for that.

This endpoint is public and requires no authentication, unlike `PATCH /cluster/v2/mode` below, which needs cluster-admin credentials.

- Added in Camunda 8.10.
- Consistency: strong.

Responses:
  200 ClusterStatusResponse — The cluster can process work; the body reports whether it is fully healthy or degraded.
  503 ClusterStatusResponse — The cluster is DOWN because no physical tenant can process work.

---
Source: https://docs.camunda.io/docs/next/apis-tools/orchestration-cluster-api-rest/specifications/get-cluster-status.api
