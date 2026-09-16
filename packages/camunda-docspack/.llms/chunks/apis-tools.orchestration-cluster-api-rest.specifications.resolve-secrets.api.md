# Resolve secrets (alpha)

`POST /secrets/resolve`

Resolve a deduplicated batch of `camunda.secrets.*` references for the caller's
physical tenant in a single round-trip.

Each reference is authorized and resolved independently. For valid requests, the endpoint
always responds with HTTP 200: successfully resolved references are returned in `resolved`,
while references that could not be resolved (for example not found, malformed or over-long,
or the caller lacks `SECRET:REVEAL` on that reference) are returned in `errors`. A failure of
one reference never fails the others. Only structurally invalid requests are rejected with
HTTP 400: a missing or non-array `references` field, more than 20 references, or a null entry.

References are resolved against the secret stores configured for the caller's physical
tenant, served from the gateway's secret cache when the value is already cached and read
from the store otherwise.

This endpoint is an [alpha feature](/components/early-access/alpha/alpha-features.md) and may be subject to change in future releases.

- Required permissions: REVEAL on SECRET.
- Added in Camunda 8.10.
- Consistency: strong.

Authentication: bearerAuth or basicAuth

Request body:
  application/json: SecretResolveRequest (required)
    references (string[], required) — The secret references to resolve, each of the form `camunda.secrets.<name>`. Duplicate references are deduplicated by the server and resolved once. At most 20…

Responses:
  200 SecretResolveResult — The batch was processed. Per-reference outcomes are split between `resolved` and `errors`; this status is returned even when some or all references failed.
  400 ProblemDetail — The provided data is not valid.
  401 ProblemDetail — The request lacks valid authentication credentials.
  500 ProblemDetail — An internal error occurred while processing the request.
  503 ProblemDetail — The service is currently unavailable. This may happen only on some requests where the system creates backpressure to prevent the server's compute resources from being exhausted, avoiding more severe failures. In this case, the title of the error object contains `RESOURCE_EXHAUSTED`. Clients are recommended to eventually retry those requests after a backoff period. You can learn more about the backpressure mechanism here: https://docs.camunda.io/docs/components/zeebe/technical-concepts/internal-processing/#handling-backpressure .

---
Source: https://docs.camunda.io/docs/next/apis-tools/orchestration-cluster-api-rest/specifications/resolve-secrets.api
