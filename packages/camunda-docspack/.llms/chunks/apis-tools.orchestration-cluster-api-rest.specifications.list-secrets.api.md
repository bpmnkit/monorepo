# List secrets (alpha)

`POST /secrets/list`

List the `camunda.secrets.*` references known for the caller's physical tenant.

Only references the caller holds `SECRET:READ` on are returned. This endpoint never
returns secret values, only the reference names.

The references are read from the secret stores configured for the caller's physical tenant.
Secret names that cannot form a valid `camunda.secrets.<name>` reference (for example names
containing a dot or a dash) are omitted, since they could neither be resolved nor be used in
a BPMN expression.

This endpoint is an [alpha feature](/components/early-access/alpha/alpha-features.md) and may be subject to change in future releases.

- Required permissions: READ on SECRET.
- Added in Camunda 8.10.
- Consistency: strong.

Authentication: bearerAuth or basicAuth

Request body:
  application/json: SecretListRequest

Responses:
  200 SecretListResult — The references the caller is authorized to see.
  400 ProblemDetail — The provided data is not valid.
  401 ProblemDetail — The request lacks valid authentication credentials.
  500 ProblemDetail — An internal error occurred while processing the request.
  503 ProblemDetail — The service is currently unavailable. This may happen only on some requests where the system creates backpressure to prevent the server's compute resources from being exhausted, avoiding more severe failures. In this case, the title of the error object contains `RESOURCE_EXHAUSTED`. Clients are recommended to eventually retry those requests after a backoff period. You can learn more about the backpressure mechanism here: https://docs.camunda.io/docs/components/zeebe/technical-concepts/internal-processing/#handling-backpressure .

---
Source: https://docs.camunda.io/docs/next/apis-tools/orchestration-cluster-api-rest/specifications/list-secrets.api
