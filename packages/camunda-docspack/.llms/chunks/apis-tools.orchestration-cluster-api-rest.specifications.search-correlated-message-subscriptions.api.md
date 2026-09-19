# Search correlated message subscriptions

`POST /correlated-message-subscriptions/search`

Search correlated message subscriptions based on given criteria.

- Required permissions: READ_PROCESS_INSTANCE on PROCESS_DEFINITION.
- Added in Camunda 8.8.
- Consistency: eventual.

Authentication: bearerAuth or basicAuth

Request body:
  application/json: CorrelatedMessageSubscriptionSearchQuery
    sort (CorrelatedMessageSubscriptionSearchQuerySortRequest[]) — Sort field criteria.
    filter (CorrelatedMessageSubscriptionFilter) — The correlated message subscriptions search filters.

Responses:
  200 CorrelatedMessageSubscriptionSearchQueryResult — The correlated message subscriptions search result.
  400 ProblemDetail — The provided data is not valid.
  401 ProblemDetail — The request lacks valid authentication credentials.
  403 ProblemDetail — Forbidden. The request is not allowed.
  500 ProblemDetail — An internal error occurred while processing the request.

---
Source: https://docs.camunda.io/docs/next/apis-tools/orchestration-cluster-api-rest/specifications/search-correlated-message-subscriptions.api
