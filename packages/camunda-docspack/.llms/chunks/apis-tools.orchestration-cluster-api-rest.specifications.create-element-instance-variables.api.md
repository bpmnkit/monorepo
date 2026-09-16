# Update element instance variables

`PUT /element-instances/{elementInstanceKey}/variables`

Updates all the variables of a particular scope (for example, process instance, element instance) with the given variable data.
Specify the element instance in the `elementInstanceKey` parameter.
Variable updates can be delayed by listener-related processing; if processing exceeds the
request timeout, this endpoint can return 504. Other gateway timeout causes are also
possible. Retry with backoff and inspect listener worker availability and logs when this
repeats.

- Required permissions: UPDATE_PROCESS_INSTANCE on PROCESS_DEFINITION.
- Added in Camunda 8.6.
- Consistency: strong.

Authentication: bearerAuth or basicAuth

Parameters:
  elementInstanceKey (path, string, required)

Request body:
  application/json: SetVariableRequest (required)
    variables (object, required) — JSON object representing the variables to set in the element’s scope.
    local (boolean) — If set to `true`, the variables are merged strictly into the local scope (as specified by the `elementInstanceKey`). Otherwise, the variables are propagated to…
    operationReference (OperationReference)

Responses:
  204 — The variables were updated.
  400 ProblemDetail — The provided data is not valid.
  500 ProblemDetail — An internal error occurred while processing the request.
  503 ProblemDetail — The service is currently unavailable. This may happen only on some requests where the system creates backpressure to prevent the server's compute resources from being exhausted, avoiding more severe failures. In this case, the title of the error object contains `RESOURCE_EXHAUSTED`. Clients are recommended to eventually retry those requests after a backoff period. You can learn more about the backpressure mechanism here: https://docs.camunda.io/docs/components/zeebe/technical-concepts/internal-processing/#handling-backpressure .
  504 ProblemDetail — The request timed out between the gateway and the broker. For these endpoints, this often happens when user task listeners are configured and the corresponding listener job is not completed within the request timeout. Common causes include no available job workers for the listener type, busy or crashed job workers, or delayed job completion. As with any gateway timeout, general timeout causes (for example transient network issues) can also result in a 504 response. Troubleshooting: - verify that job workers for the listener type are running and healthy - check worker logs for crashes, retries, and completion failures - check network connectivity between workers, gateway, and broker - retry with backoff after transient failures - fail without retries if a problem persists

---
Source: https://docs.camunda.io/docs/next/apis-tools/orchestration-cluster-api-rest/specifications/create-element-instance-variables.api
