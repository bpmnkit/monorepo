# Get physical tenant status

`GET /status`

Checks the health status of the default physical tenant by verifying if there's at least one partition of its group with a healthy leader. This endpoint is scoped to the default physical tenant only: it is available unprefixed and at `/physical-tenants/default/v2/status`, but not for any other physical tenant id (`/physical-tenants/{id}/v2/status` returns 404 for every other id, whether or not a physical tenant with that id exists). On a cluster with only the default physical tenant this endpoint answers the same question as `/cluster/v2/status`, though not with the same response: `/cluster/v2/status` reports its status in a body and so also distinguishes a degraded tenant from a healthy one. Use `/cluster/v2/status` for the aggregated status of the whole cluster, or `/physical-tenants/{id}/v2/topology` for the health of a specific physical tenant's partitions.

- Added in Camunda 8.8.
- Consistency: strong.

Responses:
  204 — The default physical tenant is UP and has at least one partition with a healthy leader.
  503 — The default physical tenant is DOWN and does not have any partition with a healthy leader.

---
Source: https://docs.camunda.io/docs/next/apis-tools/orchestration-cluster-api-rest/specifications/get-status.api
