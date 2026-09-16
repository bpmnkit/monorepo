# Broadcast signal

`POST /signals/broadcast`

Broadcasts a signal.

- Added in Camunda 8.6.
- Consistency: strong.

Authentication: bearerAuth or basicAuth

Request body:
  application/json: SignalBroadcastRequest (required)
    signalName (string, required) — The name of the signal to broadcast.
    variables (object) — The signal variables as a JSON object.
    tenantId (TenantId) — The ID of the tenant that owns the signal.

Responses:
  200 SignalBroadcastResult — The signal was broadcast.
  400 ProblemDetail — The provided data is not valid.
  404 ProblemDetail — The signal is not found.
  500 ProblemDetail — An internal error occurred while processing the request.
  503 ProblemDetail — The service is currently unavailable. This may happen only on some requests where the system creates backpressure to prevent the server's compute resources from being exhausted, avoiding more severe failures. In this case, the title of the error object contains `RESOURCE_EXHAUSTED`. Clients are recommended to eventually retry those requests after a backoff period. You can learn more about the backpressure mechanism here: https://docs.camunda.io/docs/components/zeebe/technical-concepts/internal-processing/#handling-backpressure .

---
Source: https://docs.camunda.io/docs/next/apis-tools/orchestration-cluster-api-rest/specifications/broadcast-signal.api
