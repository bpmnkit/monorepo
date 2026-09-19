# Get cluster topology

`GET /topology`

Obtains the current topology of the cluster the gateway is part of.

- Added in Camunda 8.5.
- Consistency: strong.

Authentication: bearerAuth or basicAuth

Responses:
  200 TopologyResponse — Obtains the current topology of the cluster the gateway is part of.
  401 ProblemDetail — The request lacks valid authentication credentials.
  500 ProblemDetail — An internal error occurred while processing the request.

---
Source: https://docs.camunda.io/docs/next/apis-tools/orchestration-cluster-api-rest/specifications/get-topology.api
