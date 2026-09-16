# Get the topology of the whole cluster

`GET /cluster/v2/topology`

Obtains the topology of the whole cluster, aggregated over all physical tenants. Cluster-level information is reported once; partition layout, replication and per-partition role, health and state are reported per physical tenant.

Requires the cluster-admin security chain. Although this operation lists `bearerAuth` / `basicAuth` like the rest of the Orchestration Cluster API, it does not accept an Orchestration Cluster user's credentials — only the separate cluster-admin credentials are valid here. Use `GET /v2/topology` for the topology of a single physical tenant.

- Added in Camunda 8.10.
- Consistency: strong.

Authentication: bearerAuth or basicAuth

Responses:
  200 ClusterTopologyResponse — The topology of the whole cluster, aggregated over all physical tenants.
  401 ProblemDetail — The request lacks valid authentication credentials.
  403 ProblemDetail — Forbidden. The request is not allowed.
  500 ProblemDetail — An internal error occurred while processing the request.

---
Source: https://docs.camunda.io/docs/next/apis-tools/orchestration-cluster-api-rest/specifications/get-cluster-topology.api
