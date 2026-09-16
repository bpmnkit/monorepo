# Correlate message

`POST /messages/correlation`

Publishes a message and correlates it to a subscription.
If correlation is successful it will return the first process instance key the message correlated with.
The message is not buffered.
Use the publish message endpoint to send messages that can be buffered.

- Added in Camunda 8.6.
- Consistency: strong.

Authentication: bearerAuth or basicAuth

Request body:
  application/json: MessageCorrelationRequest (required)
    name (string, required) — The message name as defined in the BPMN process
    correlationKey (string) — The correlation key of the message.
    variables (object) — The message variables as JSON document
    tenantId (TenantId) — the tenant for which the message is published
    businessId (BusinessId) — An optional business id used to enforce uniqueness of the process instance that a message start event would create. If provided and uniqueness enforcement is…

Responses:
  200 MessageCorrelationResult — The message is correlated to one or more process instances
  400 ProblemDetail — The provided data is not valid.
  403 ProblemDetail — Forbidden. The request is not allowed.
  404 ProblemDetail — Not found
  500 ProblemDetail — An internal error occurred while processing the request.
  503 ProblemDetail — The service is currently unavailable. This may happen only on some requests where the system creates backpressure to prevent the server's compute resources from being exhausted, avoiding more severe failures. In this case, the title of the error object contains `RESOURCE_EXHAUSTED`. Clients are recommended to eventually retry those requests after a backoff period. You can learn more about the backpressure mechanism here: https://docs.camunda.io/docs/components/zeebe/technical-concepts/internal-processing/#handling-backpressure .

---
Source: https://docs.camunda.io/docs/next/apis-tools/orchestration-cluster-api-rest/specifications/correlate-message.api
