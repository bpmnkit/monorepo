# Pin internal clock (alpha)

`PUT /clock`

Set a precise, static time for the Zeebe engine's internal clock.
When the clock is pinned, it remains at the specified time and does not advance.
To change the time, the clock must be pinned again with a new timestamp.

:::note
This endpoint is an [alpha feature](/components/early-access/alpha/alpha-features.md) and may be subject to change
in future releases.
:::

- Required permissions: UPDATE on SYSTEM.
- Added in Camunda 8.6.
- Consistency: strong.

Authentication: bearerAuth or basicAuth

Request body:
  application/json: ClockPinRequest (required)
    timestamp (integer, required) — The exact time in epoch milliseconds to which the clock should be pinned.

Responses:
  204 — The clock was successfully pinned.
  400 ProblemDetail — The provided data is not valid.
  500 ProblemDetail — An internal error occurred while processing the request.
  503 ProblemDetail — The service is currently unavailable. This may happen only on some requests where the system creates backpressure to prevent the server's compute resources from being exhausted, avoiding more severe failures. In this case, the title of the error object contains `RESOURCE_EXHAUSTED`. Clients are recommended to eventually retry those requests after a backoff period. You can learn more about the backpressure mechanism here: https://docs.camunda.io/docs/components/zeebe/technical-concepts/internal-processing/#handling-backpressure .

---
Source: https://docs.camunda.io/docs/next/apis-tools/orchestration-cluster-api-rest/specifications/pin-clock.api
