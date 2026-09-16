# Get audit log

`GET /audit-logs/{auditLogKey}`

Get an audit log entry by auditLogKey.

- Required permissions: READ on AUDIT_LOG.
- Added in Camunda 8.9.
- Consistency: eventual.

Authentication: bearerAuth or basicAuth

Parameters:
  auditLogKey (path, string, required)

Responses:
  200 AuditLogResult — The audit log entry is successfully returned.
  401 ProblemDetail — The request lacks valid authentication credentials.
  403 ProblemDetail — Forbidden. The request is not allowed.
  404 ProblemDetail — The audit log with the given key was not found.
  500 ProblemDetail — An internal error occurred while processing the request.

---
Source: https://docs.camunda.io/docs/next/apis-tools/orchestration-cluster-api-rest/specifications/get-audit-log.api
