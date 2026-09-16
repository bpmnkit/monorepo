# Delete resource

`POST /resources/{resourceKey}/deletion`

Deletes a deployed resource. This can be a process definition, decision requirements
definition, or form definition deployed using the deploy resources endpoint. Specify the
resource you want to delete in the `resourceKey` parameter.

Once a resource has been deleted it cannot be recovered. If the resource needs to be
available again, a new deployment of the resource is required.

By default, only the resource itself is deleted from the runtime state. To also delete the
historic data associated with a resource, set the `deleteHistory` flag in the request body
to `true`. History deletion is supported for process definitions and decision requirements
definitions; for other resource types (forms, generic resources) the flag is ignored and no
history is deleted.

The two supported types differ in how the history is removed. For a decision requirements
definition the history is deleted asynchronously via a batch operation whose details are
returned in the `batchOperation` field of the response. For a process definition the
definition first drains its running instances and its history is deleted asynchronously once
the definition is fully removed cluster-wide; no batch operation is returned in the response.

- Added in Camunda 8.6.
- Consistency: strong.

Authentication: bearerAuth or basicAuth

Parameters:
  resourceKey (path, ResourceKey, required)

Request body:
  application/json: DeleteResourceRequest
    operationReference (OperationReference)
    deleteHistory (boolean) — Indicates if the historic data associated with the resource should also be deleted asynchronously. This flag is effective for process definitions and decision…

Responses:
  200 DeleteResourceResponse — The resource is deleted.
  400 ProblemDetail — The provided data is not valid.
  404 ProblemDetail — The resource is not found.
  500 ProblemDetail — An internal error occurred while processing the request.
  503 ProblemDetail — The service is currently unavailable. This may happen only on some requests where the system creates backpressure to prevent the server's compute resources from being exhausted, avoiding more severe failures. In this case, the title of the error object contains `RESOURCE_EXHAUSTED`. Clients are recommended to eventually retry those requests after a backoff period. You can learn more about the backpressure mechanism here: https://docs.camunda.io/docs/components/zeebe/technical-concepts/internal-processing/#handling-backpressure .

---
Source: https://docs.camunda.io/docs/next/apis-tools/orchestration-cluster-api-rest/specifications/delete-resource.api
