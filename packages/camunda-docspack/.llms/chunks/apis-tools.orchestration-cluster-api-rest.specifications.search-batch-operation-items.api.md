# Search batch operation items

`POST /batch-operation-items/search`

Search for batch operation items based on given criteria.

- Required permissions: READ on BATCH.
- Added in Camunda 8.8.
- Consistency: eventual.

Authentication: bearerAuth or basicAuth

Request body:
  application/json: BatchOperationItemSearchQuery
    sort (BatchOperationItemSearchQuerySortRequest[]) — Sort field criteria.
    filter (BatchOperationItemFilter) — The batch operation item search filters.

Responses:
  200 BatchOperationItemSearchQueryResult — The batch operation search result.
  400 ProblemDetail — The provided data is not valid.
  500 ProblemDetail — An internal error occurred while processing the request.

---
Source: https://docs.camunda.io/docs/next/apis-tools/orchestration-cluster-api-rest/specifications/search-batch-operation-items.api
