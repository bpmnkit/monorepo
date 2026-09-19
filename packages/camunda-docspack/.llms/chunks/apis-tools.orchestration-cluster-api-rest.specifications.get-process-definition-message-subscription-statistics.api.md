# Get message subscription statistics

`POST /process-definitions/statistics/message-subscriptions`

Get message subscription statistics, grouped by process definition.

- Required permissions: READ_PROCESS_INSTANCE on PROCESS_DEFINITION.
- Added in Camunda 8.9.
- Consistency: eventual.

Authentication: bearerAuth or basicAuth

Request body:
  application/json: ProcessDefinitionMessageSubscriptionStatisticsQuery
    page (CursorForwardPagination) — Search cursor pagination.
    filter (MessageSubscriptionFilter) — The message subscription filters.

Responses:
  200 ProcessDefinitionMessageSubscriptionStatisticsQueryResult — The process definition message subscription statistics result.
  400 ProblemDetail — The provided data is not valid.
  401 ProblemDetail — The request lacks valid authentication credentials.
  403 ProblemDetail — Forbidden. The request is not allowed.
  500 ProblemDetail — An internal error occurred while processing the request.

---
Source: https://docs.camunda.io/docs/next/apis-tools/orchestration-cluster-api-rest/specifications/get-process-definition-message-subscription-statistics.api
