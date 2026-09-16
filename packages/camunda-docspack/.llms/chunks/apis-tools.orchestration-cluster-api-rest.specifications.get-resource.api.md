# Get resource

`GET /resources/{resourceKey}`

Returns a deployed resource.
:::info
This endpoint does not return BPMN process definitions, DMN decision definitions, or form
resources. To query BPMN process definitions or DMN decision definitions, use their
respective APIs.
:::

- Required permissions: READ on RESOURCE.
- Added in Camunda 8.7.
- Consistency: eventual.

Authentication: bearerAuth or basicAuth

Parameters:
  resourceKey (path, ResourceKey, required)

Responses:
  200 ResourceResult — The resource is successfully returned.
  404 ProblemDetail — A resource with the given key was not found.
  500 ProblemDetail — An internal error occurred while processing the request.

---
Source: https://docs.camunda.io/docs/next/apis-tools/orchestration-cluster-api-rest/specifications/get-resource.api
