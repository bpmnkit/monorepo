# Get license status

`GET /license`

Obtains the status of the current Camunda license.

- Added in Camunda 8.6.
- Consistency: strong.

Responses:
  200 LicenseResponse — Obtains the current status of the Camunda license.
  500 ProblemDetail — An internal error occurred while processing the request.

---
Source: https://docs.camunda.io/docs/next/apis-tools/orchestration-cluster-api-rest/specifications/get-license.api
