# System configuration (alpha)

`GET /system/configuration`

Returns the current system configuration. The response is an envelope
that groups settings by feature area.

:::note
This endpoint is an [alpha feature](/components/early-access/alpha/alpha-features.md) and may be subject to change
in future releases.
:::

- Added in Camunda 8.9.
- Consistency: strong.

Authentication: bearerAuth or basicAuth

Responses:
  200 SystemConfigurationResponse — Current system configuration grouped by feature area.
  401 ProblemDetail — The request lacks valid authentication credentials.
  500 ProblemDetail — An internal error occurred while processing the request.

---
Source: https://docs.camunda.io/docs/next/apis-tools/orchestration-cluster-api-rest/specifications/get-system-configuration.api
