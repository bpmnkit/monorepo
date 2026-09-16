# Create a global-scoped cluster variable

`POST /cluster-variables/global`

Create a global-scoped cluster variable.

- Required permissions: CREATE on CLUSTER_VARIABLE.
- Added in Camunda 8.9.
- Consistency: strong.

Authentication: bearerAuth or basicAuth

Request body:
  application/json: CreateClusterVariableRequest (required)
    name (ClusterVariableName, required) — The name of the cluster variable. Must be unique within its scope (global or tenant-specific).
    value (object, required) — The value of the cluster variable. Can be any JSON object or primitive value. Will be serialized as a JSON string in responses.
    metadata (object) — A generic key-value metadata bag attached to the cluster variable. Values must be strings or numbers. Limited to 100 entries and a configurable maximum…
    kind (ClusterVariableKindEnum) — The kind of the cluster variable. Defaults to JSON if not specified.

Responses:
  200 ClusterVariableResult — Cluster variable created
  400 ProblemDetail — The provided data is not valid.
  401 ProblemDetail — The request lacks valid authentication credentials.
  403 ProblemDetail — Forbidden. The request is not allowed.
  409 ProblemDetail — A cluster variable with this name already exists.
  500 ProblemDetail — An internal error occurred while processing the request.

---
Source: https://docs.camunda.io/docs/next/apis-tools/orchestration-cluster-api-rest/specifications/create-global-cluster-variable.api
