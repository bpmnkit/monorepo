# Search audit logs

`POST /audit-logs/search`

Search for audit logs based on given criteria.

- Required permissions: READ on AUDIT_LOG.
- Added in Camunda 8.9.
- Consistency: eventual.

Authentication: bearerAuth or basicAuth

Request body:
  application/json: AuditLogSearchQueryRequest
    sort (AuditLogSearchQuerySortRequest[]) — Sort field criteria.
    filter (AuditLogFilter) — The audit log search filters.

Responses:
  200 AuditLogSearchQueryResult — The audit logs search result.
  400 ProblemDetail — The provided data is not valid.
  401 ProblemDetail — The request lacks valid authentication credentials.
  403 ProblemDetail — Forbidden. The request is not allowed.
  500 — An internal error occurred while processing the request.

---
Source: https://docs.camunda.io/docs/next/apis-tools/orchestration-cluster-api-rest/specifications/search-audit-logs.api
