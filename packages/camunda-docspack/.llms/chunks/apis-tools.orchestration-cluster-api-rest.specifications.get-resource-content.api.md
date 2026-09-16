# Get RPA resource content (deprecated)

`GET /resources/{resourceKey}/content`

**Deprecated** — use `/resources/{resourceKey}/content/binary` instead, which supports all
resource types and returns content as binary (octet-stream).

Returns the content of a deployed RPA resource as JSON.
:::info
This endpoint only supports RPA resources. For generic resource content in binary format,
use the `/resources/{resourceKey}/content/binary` endpoint.
:::

- Required permissions: READ on RESOURCE.
- Added in Camunda 8.7.
- Consistency: eventual.

Authentication: bearerAuth or basicAuth

Parameters:
  resourceKey (path, ResourceKey, required)

Responses:
  200 object — The resource content is successfully returned.
  404 ProblemDetail — A resource with the given key was not found.
  406 ProblemDetail — The resource exists but is not an RPA resource.
  500 ProblemDetail — An internal error occurred while processing the request.

---
Source: https://docs.camunda.io/docs/next/apis-tools/orchestration-cluster-api-rest/specifications/get-resource-content.api
