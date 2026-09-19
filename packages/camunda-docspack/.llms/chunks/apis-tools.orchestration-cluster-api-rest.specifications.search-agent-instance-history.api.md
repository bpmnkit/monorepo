# Search agent instance history

`POST /agent-instances/{agentInstanceKey}/history/search`

Searches the conversation history of an agent instance. Committed items
are returned by default.

- Required permissions: READ_PROCESS_INSTANCE on PROCESS_DEFINITION.
- Added in Camunda 8.10.
- Consistency: eventual.

Authentication: bearerAuth or basicAuth

Parameters:
  agentInstanceKey (path, string, required)

Request body:
  application/json: AgentInstanceHistorySearchQuery
    sort (AgentInstanceHistorySearchQuerySortRequest[]) — Sort field criteria.
    filter (AgentInstanceHistoryFilter) — The history item search filters.

Responses:
  200 AgentInstanceHistorySearchQueryResult — The agent instance history search result.
  400 ProblemDetail — The provided data is not valid.
  401 ProblemDetail — The request lacks valid authentication credentials.
  403 ProblemDetail — Forbidden. The request is not allowed.
  404 ProblemDetail — The agent instance with the given key was not found. More details are provided in the response body.
  500 ProblemDetail — An internal error occurred while processing the request.

---
Source: https://docs.camunda.io/docs/next/apis-tools/orchestration-cluster-api-rest/specifications/search-agent-instance-history.api
