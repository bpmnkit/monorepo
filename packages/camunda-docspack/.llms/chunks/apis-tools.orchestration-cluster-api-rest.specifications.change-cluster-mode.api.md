# Change cluster mode

`PATCH /mode`

Transitions the cluster between processing and recovery mode. This is a non-blocking operation: the request is acknowledged once the change has been accepted, before the transition itself has completed. Entering recovery mode deactivates all partitions so that only a restricted set of read-only operations remains available; exiting recovery mode returns the cluster to normal processing. Returns the planned cluster change so its progress can be monitored via the topology.

- Added in Camunda 8.10.
- Consistency: strong.

Authentication: bearerAuth or basicAuth

Parameters:
  mode (query, Mode, required)
  dryRun (query, boolean)

Responses:
  200 ClusterModeChangeResponse — The mode change request was accepted; returns the planned cluster changes.
  400 ProblemDetail — The provided data is not valid.
  401 ProblemDetail — The request lacks valid authentication credentials.
  403 ProblemDetail — Forbidden. The request is not allowed.
  500 ProblemDetail — An internal error occurred while processing the request.

---
Source: https://docs.camunda.io/docs/next/apis-tools/orchestration-cluster-api-rest/specifications/change-cluster-mode.api
