# Activate activities within an ad-hoc sub-process

`POST /element-instances/ad-hoc-activities/{adHocSubProcessInstanceKey}/activation`

Activates selected activities within an ad-hoc sub-process identified by element ID.
The provided element IDs must exist within the ad-hoc sub-process instance identified by the
provided adHocSubProcessInstanceKey.

- Required permissions: UPDATE_PROCESS_INSTANCE on PROCESS_DEFINITION.
- Added in Camunda 8.8.
- Consistency: strong.

Authentication: bearerAuth or basicAuth

Parameters:
  adHocSubProcessInstanceKey (path, string, required)

Request body:
  application/json: AdHocSubProcessActivateActivitiesInstruction (required)
    elements (AdHocSubProcessActivateActivityReference[], required) — Activities to activate.
    cancelRemainingInstances (boolean) — Whether to cancel remaining instances of the ad-hoc sub-process.

Responses:
  204 — The ad-hoc sub-process instance is modified.
  400 ProblemDetail — The provided data is not valid.
  401 ProblemDetail — The request lacks valid authentication credentials.
  403 ProblemDetail — Forbidden. The request is not allowed.
  404 ProblemDetail — The ad-hoc sub-process instance is not found or the provided key does not identify an ad-hoc sub-process.
  500 ProblemDetail — An internal error occurred while processing the request.
  503 ProblemDetail — The service is currently unavailable. This may happen only on some requests where the system creates backpressure to prevent the server's compute resources from being exhausted, avoiding more severe failures. In this case, the title of the error object contains `RESOURCE_EXHAUSTED`. Clients are recommended to eventually retry those requests after a backoff period. You can learn more about the backpressure mechanism here: https://docs.camunda.io/docs/components/zeebe/technical-concepts/internal-processing/#handling-backpressure .

---
Source: https://docs.camunda.io/docs/next/apis-tools/orchestration-cluster-api-rest/specifications/activate-ad-hoc-sub-process-activities.api
