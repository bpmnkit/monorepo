# Reset internal clock (alpha)

`POST /clock/reset`

Resets the Zeebe engine's internal clock to the current system time, enabling it to tick in real-time.
This operation is useful for returning the clock to
normal behavior after it has been pinned to a specific time.

:::note
This endpoint is an [alpha feature](/components/early-access/alpha/alpha-features.md) and may be subject to change
in future releases.
:::

- Required permissions: UPDATE on SYSTEM.
- Added in Camunda 8.6.
- Consistency: strong.

Authentication: bearerAuth or basicAuth

Responses:
  204 — The clock was successfully reset to the system time.
  500 ProblemDetail — An internal error occurred while processing the request.
  503 ProblemDetail — The service is currently unavailable. This may happen only on some requests where the system creates backpressure to prevent the server's compute resources from being exhausted, avoiding more severe failures. In this case, the title of the error object contains `RESOURCE_EXHAUSTED`. Clients are recommended to eventually retry those requests after a backoff period. You can learn more about the backpressure mechanism here: https://docs.camunda.io/docs/components/zeebe/technical-concepts/internal-processing/#handling-backpressure .

---
Source: https://docs.camunda.io/docs/next/apis-tools/orchestration-cluster-api-rest/specifications/reset-clock.api
