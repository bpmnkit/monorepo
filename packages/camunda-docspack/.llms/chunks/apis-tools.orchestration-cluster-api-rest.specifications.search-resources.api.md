# Search resources

`POST /resources/search`

Search for deployed resources based on given criteria.
:::info
This endpoint does not return BPMN process definitions, DMN decision definitions, or form
resources. To query BPMN process definitions or DMN decision definitions, use their
respective search APIs.
:::

- Required permissions: READ on RESOURCE.
- Added in Camunda 8.10.
- Consistency: eventual.

Authentication: bearerAuth or basicAuth

Request body:
  application/json: ResourceSearchQuery
    sort (ResourceSearchQuerySortRequest[]) — Sort field criteria.
    filter (ResourceFilter) — The resource search filters.

Responses:
  200 ResourceSearchQueryResult — The resource search result.
  400 ProblemDetail — The provided data is not valid.
  401 ProblemDetail — The request lacks valid authentication credentials.
  403 ProblemDetail — Forbidden. The request is not allowed.
  500 ProblemDetail — An internal error occurred while processing the request.

---
Source: https://docs.camunda.io/docs/next/apis-tools/orchestration-cluster-api-rest/specifications/search-resources.api
