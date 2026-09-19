# Search user task audit logs

`POST /user-tasks/{userTaskKey}/audit-logs/search`

Search for user task audit logs based on given criteria.

- Added in Camunda 8.9.
- Consistency: eventual.

Authentication: bearerAuth or basicAuth

Parameters:
  userTaskKey (path, string, required)

Request body:
  application/json: UserTaskAuditLogSearchQueryRequest
    sort (AuditLogSearchQuerySortRequest[]) — Sort field criteria.
    filter (UserTaskAuditLogFilter)

Responses:
  200 AuditLogSearchQueryResult — The user task audit log search result.
  400 ProblemDetail — The provided data is not valid.
  500 ProblemDetail — An internal error occurred while processing the request.

---
Source: https://docs.camunda.io/docs/next/apis-tools/orchestration-cluster-api-rest/specifications/search-user-task-audit-logs.api
