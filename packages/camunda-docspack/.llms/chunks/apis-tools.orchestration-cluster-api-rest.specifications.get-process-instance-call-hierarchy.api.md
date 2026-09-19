# Get call hierarchy

`GET /process-instances/{processInstanceKey}/call-hierarchy`

Returns the call hierarchy for a given process instance, showing its ancestry up to the root instance.

- Required permissions: READ_PROCESS_INSTANCE on PROCESS_DEFINITION.
- Added in Camunda 8.8.
- Consistency: eventual.

Authentication: bearerAuth or basicAuth

Parameters:
  processInstanceKey (path, string, required)

Responses:
  200 ProcessInstanceCallHierarchyEntry[] — The call hierarchy is successfully returned.
  400 ProblemDetail — The provided data is not valid.
  401 ProblemDetail — The request lacks valid authentication credentials.
  403 ProblemDetail — Forbidden. The request is not allowed.
  404 ProblemDetail — The process instance is not found.
  500 ProblemDetail — An internal error occurred while processing the request.

---
Source: https://docs.camunda.io/docs/next/apis-tools/orchestration-cluster-api-rest/specifications/get-process-instance-call-hierarchy.api
