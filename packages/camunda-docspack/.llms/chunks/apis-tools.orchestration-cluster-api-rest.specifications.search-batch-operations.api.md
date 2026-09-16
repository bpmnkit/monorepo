# Search batch operations

`POST /batch-operations/search`

Search for batch operations based on given criteria.

- Required permissions: READ on BATCH.
- Added in Camunda 8.8.
- Consistency: eventual.

Authentication: bearerAuth or basicAuth

Request body:
  application/json: BatchOperationSearchQuery
    sort (BatchOperationSearchQuerySortRequest[]) — Sort field criteria.
    filter (BatchOperationFilter) — The batch operation search filters.

Responses:
  200 BatchOperationSearchQueryResult — The batch operation search result.
  400 ProblemDetail — The provided data is not valid.
  500 ProblemDetail — An internal error occurred while processing the request.

---
Source: https://docs.camunda.io/docs/next/apis-tools/orchestration-cluster-api-rest/specifications/search-batch-operations.api
