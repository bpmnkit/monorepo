# Update a global-scoped cluster variable

`PUT /cluster-variables/global/{name}`

Updates the value of an existing global cluster variable.
The variable must exist, otherwise a 404 error is returned.

- Required permissions: UPDATE on CLUSTER_VARIABLE.
- Added in Camunda 8.9.
- Consistency: strong.

Authentication: bearerAuth or basicAuth

Parameters:
  name (path, ClusterVariableName, required)

Request body:
  application/json: UpdateClusterVariableRequest (required)
    value (object, required) — The new value of the cluster variable. Can be any JSON object or primitive value. Will be serialized as a JSON string in responses.
    metadata (object) — A generic key-value metadata bag attached to the cluster variable. Values must be strings or numbers. Limited to 100 entries and a configurable maximum…

Responses:
  200 ClusterVariableResult — Cluster variable updated successfully
  400 ProblemDetail — The provided data is not valid.
  401 ProblemDetail — The request lacks valid authentication credentials.
  403 ProblemDetail — Forbidden. The request is not allowed.
  404 ProblemDetail — Cluster variable not found
  500 ProblemDetail — An internal error occurred while processing the request.

---
Source: https://docs.camunda.io/docs/next/apis-tools/orchestration-cluster-api-rest/specifications/update-global-cluster-variable.api
