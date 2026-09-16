# Search message subscriptions

`POST /message-subscriptions/search`

Search for message subscriptions based on given criteria.

By default, both start and intermediate event subscriptions are returned. Use the
`messageSubscriptionType` filter to restrict results to a single type.

**Version notes:**
- Start event subscriptions are only captured for deployments made with 8.10 or later.
- The `messageSubscriptionType` field is only populated for data created
  with Camunda 8.10 or later. For pre-8.10 data, intermediate event entries have no
  `messageSubscriptionType` value stored. For convenience, the API returns `PROCESS_EVENT`
  as a default for such search results, though.
- Searching for intermediate event subscriptions **including legacy data** can be achieved
  by filtering for `messageSubscriptionType` not matching `START_EVENT`.

- Required permissions: READ_PROCESS_INSTANCE on PROCESS_DEFINITION.
- Added in Camunda 8.8.
- Consistency: eventual.

Authentication: bearerAuth or basicAuth

Request body:
  application/json: MessageSubscriptionSearchQuery
    sort (MessageSubscriptionSearchQuerySortRequest[]) — Sort field criteria.
    filter (MessageSubscriptionFilter) — The incident search filters.

Responses:
  200 MessageSubscriptionSearchQueryResult — The message subscription search result.
  400 ProblemDetail — The provided data is not valid.
  401 ProblemDetail — The request lacks valid authentication credentials.
  403 ProblemDetail — Forbidden. The request is not allowed.
  500 ProblemDetail — An internal error occurred while processing the request.

---
Source: https://docs.camunda.io/docs/next/apis-tools/orchestration-cluster-api-rest/specifications/search-message-subscriptions.api
