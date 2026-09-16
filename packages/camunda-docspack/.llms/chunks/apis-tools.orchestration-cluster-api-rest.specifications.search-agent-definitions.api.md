# Search agent definitions

`POST /agent-definitions/search`

Search for agent definitions based on given criteria.

- Required permissions: READ_PROCESS_DEFINITION on PROCESS_DEFINITION.
- Added in Camunda 8.10.
- Consistency: eventual.

Authentication: bearerAuth or basicAuth

Request body:
  application/json: AgentDefinitionSearchQuery
    sort (AgentDefinitionSearchQuerySortRequest[]) — Sort field criteria.
    filter (AgentDefinitionFilter) — The agent definition search filters.

Responses:
  200 AgentDefinitionSearchQueryResult — The agent definition search result.
  400 ProblemDetail — The provided data is not valid.
  401 ProblemDetail — The request lacks valid authentication credentials.
  403 ProblemDetail — Forbidden. The request is not allowed.
  500 ProblemDetail — An internal error occurred while processing the request.

---
Source: https://docs.camunda.io/docs/next/apis-tools/orchestration-cluster-api-rest/specifications/search-agent-definitions.api
