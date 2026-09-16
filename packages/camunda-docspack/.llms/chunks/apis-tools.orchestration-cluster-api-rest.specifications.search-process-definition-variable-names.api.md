# Search process definition variable names

`POST /process-definitions/{processDefinitionKey}/variable-names/search`

Search for distinct variable names defined on a process definition, optionally narrowed by the name filter.

- Required permissions: READ_PROCESS_INSTANCE on PROCESS_DEFINITION.
- Added in Camunda 8.10.
- Consistency: eventual.

Authentication: bearerAuth or basicAuth

Parameters:
  processDefinitionKey (path, string, required)

Request body:
  application/json: ProcessDefinitionVariableNameSearchQuery
    filter (ProcessDefinitionVariableNameFilter) — The process definition variable name search filters.

Responses:
  200 ProcessDefinitionVariableNameSearchQueryResult — The process definition variable name search result.
  400 ProblemDetail — The provided data is not valid.
  401 ProblemDetail — The request lacks valid authentication credentials.
  403 ProblemDetail — Forbidden. The request is not allowed.
  500 ProblemDetail — An internal error occurred while processing the request.

---
Source: https://docs.camunda.io/docs/next/apis-tools/orchestration-cluster-api-rest/specifications/search-process-definition-variable-names.api
