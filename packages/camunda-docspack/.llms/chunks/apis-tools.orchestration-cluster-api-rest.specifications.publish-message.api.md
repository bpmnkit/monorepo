# Publish message

`POST /messages/publication`

Publishes a single message.
Messages are published to specific partitions computed from their correlation keys.
Messages can be buffered.
The endpoint does not wait for a correlation result.
Use the message correlation endpoint for such use cases.

- Required permissions: CREATE on MESSAGE.
- Added in Camunda 8.6.
- Consistency: strong.

Authentication: bearerAuth or basicAuth

Request body:
  application/json: MessagePublicationRequest (required)
    name (string, required) — The name of the message.
    correlationKey (string) — The correlation key of the message.
    timeToLive (integer) — Timespan (in ms) to buffer the message on the broker.
    messageId (string) — The unique ID of the message. This is used to ensure only one message with the given ID will be published during the lifetime of the message (if `timeToLive`…
    variables (object) — The message variables as JSON document.
    tenantId (TenantId) — The tenant of the message sender.
    businessId (BusinessId) — An optional business id used to enforce uniqueness of the process instance that a message start event would create. If provided and uniqueness enforcement is…

Responses:
  200 MessagePublicationResult — The message was published.
  400 ProblemDetail — The provided data is not valid.
  500 ProblemDetail — An internal error occurred while processing the request.
  503 ProblemDetail — The service is currently unavailable. This may happen only on some requests where the system creates backpressure to prevent the server's compute resources from being exhausted, avoiding more severe failures. In this case, the title of the error object contains `RESOURCE_EXHAUSTED`. Clients are recommended to eventually retry those requests after a backoff period. You can learn more about the backpressure mechanism here: https://docs.camunda.io/docs/components/zeebe/technical-concepts/internal-processing/#handling-backpressure .

---
Source: https://docs.camunda.io/docs/next/apis-tools/orchestration-cluster-api-rest/specifications/publish-message.api
