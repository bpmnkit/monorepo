# Search agent instances

`POST /agent-instances/search`

Search for agent instances based on given criteria.

- Required permissions: READ_PROCESS_INSTANCE on PROCESS_DEFINITION.
- Added in Camunda 8.10.
- Consistency: eventual.

Authentication: bearerAuth or basicAuth

Request body:
  application/json: AgentInstanceSearchQuery
    sort (AgentInstanceSearchQuerySortRequest[]) — Sort field criteria.
    filter (AgentInstanceFilter) — The agent instance search filters.

Responses:
  200 AgentInstanceSearchQueryResult — The agent instance search result.
  400 ProblemDetail — The provided data is not valid.
  401 ProblemDetail — The request lacks valid authentication credentials.
  403 ProblemDetail — Forbidden. The request is not allowed.
  500 ProblemDetail — An internal error occurred while processing the request.

---
Source: https://docs.camunda.io/docs/next/apis-tools/orchestration-cluster-api-rest/specifications/search-agent-instances.api
